#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
process.py - Processa arquivos PTS para visualização 3D estilo Matterport
Inclui:
- Conversão de nuvem de pontos para PLY otimizado
- Geração de mesh simplificado com precisão para medições
- Criação de planta baixa
"""

import os
import sys
import numpy as np
import open3d as o3d
import pandas as pd
from PIL import Image, ImageDraw
import time
import gc
import logging
from tqdm import tqdm
import multiprocessing
from pathlib import Path
import json

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Diretórios
INPUT_DIR = Path('input')
OUTPUT_DIR = Path('output')
BATCH_SIZE = 1000000  # Processar pontos em lotes para economizar memória

def ensure_dirs():
    """Garante que os diretórios necessários existam"""
    dirs = [INPUT_DIR, OUTPUT_DIR]
    for d in dirs:
        d.mkdir(exist_ok=True)
    logger.info(f"Diretórios verificados: {', '.join(str(d) for d in dirs)}")

def load_pts_in_batches(file_path, batch_size=BATCH_SIZE):
    """Carrega arquivo PTS em lotes para economizar memória"""
    logger.info(f"Carregando arquivo PTS em lotes: {file_path}")
    
    # Primeiro, conta o número total de pontos para informação
    total_points = 0
    with open(file_path, 'r') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                total_points += 1
    
    logger.info(f"Total de pontos: {total_points}")
    
    # Agora processa em lotes
    points_list = []
    colors_list = []
    points_processed = 0
    
    with open(file_path, 'r') as f:
        batch_points = []
        batch_colors = []
        
        for i, line in enumerate(tqdm(f, total=total_points, desc="Carregando pontos")):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            try:
                values = line.split()
                if len(values) >= 6:  # x, y, z, r, g, b (e possivelmente mais)
                    x, y, z = float(values[0]), float(values[1]), float(values[2])
                    r, g, b = int(values[3]), int(values[4]), int(values[5])
                    
                    batch_points.append([x, y, z])
                    batch_colors.append([r/255.0, g/255.0, b/255.0])  # Normaliza cores para [0,1]
                    
                    if len(batch_points) >= batch_size:
                        points_list.append(np.array(batch_points))
                        colors_list.append(np.array(batch_colors))
                        points_processed += len(batch_points)
                        logger.info(f"Processados {points_processed}/{total_points} pontos ({points_processed/total_points*100:.1f}%)")
                        batch_points = []
                        batch_colors = []
                        # Força coleta de lixo
                        gc.collect()
            except Exception as e:
                logger.warning(f"Erro ao processar linha {i}: {e}")
    
    # Adiciona o último lote se houver pontos restantes
    if batch_points:
        points_list.append(np.array(batch_points))
        colors_list.append(np.array(batch_colors))
    
    return points_list, colors_list, total_points

def process_point_cloud(input_file, output_dir, voxel_size=0.05):
    """Processa nuvem de pontos com otimização de memória"""
    start_time = time.time()
    
    # Cria subdiretório para saída
    scan_name = os.path.splitext(os.path.basename(input_file))[0]
    output_subdir = output_dir / scan_name
    output_subdir.mkdir(exist_ok=True)
    
    # Arquivo de saída PLY
    output_cloud = output_subdir / "output_cloud.ply"
    output_mesh = output_subdir / "output_mesh.ply"
    output_floor_plan = output_subdir / "floor_plan.png"
    
    # Se já existirem arquivos de saída, pergunta se deseja reprocessar
    if output_cloud.exists() and output_mesh.exists() and output_floor_plan.exists():
        logger.info(f"Arquivos de saída já existem para {scan_name}. Pulando processamento.")
        return
    
    logger.info(f"Processando nuvem de pontos: {input_file}")
    
    # Carrega pontos em lotes
    points_batches, colors_batches, total_points = load_pts_in_batches(input_file)
    
    # Combina os lotes em uma única nuvem de pontos (isso pode consumir muita memória)
    logger.info("Combinando lotes em uma única nuvem de pontos...")
    all_points = np.vstack(points_batches)
    all_colors = np.vstack(colors_batches)
    
    # Libera memória dos lotes
    points_batches = None
    colors_batches = None
    gc.collect()
    
    # Cria nuvem de pontos Open3D
    logger.info("Criando nuvem de pontos Open3D...")
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(all_points)
    pcd.colors = o3d.utility.Vector3dVector(all_colors)
    
    # Calcula o centro da nuvem (importante para posicionamento)
    center = pcd.get_center()
    
    # Salva coordenadas do centro para uso posterior
    with open(output_subdir / "center_coordinates.txt", "w") as f:
        f.write(f"center = [{center[0]}, {center[1]}, {center[2]}]\n")
    
    # Reduz a nuvem para economizar memória enquanto mantém detalhes suficientes
    logger.info(f"Downsampling da nuvem (voxel_size={voxel_size})...")
    pcd_down = pcd.voxel_down_sample(voxel_size=voxel_size)
    logger.info(f"Pontos originais: {len(pcd.points)}, Após downsampling: {len(pcd_down.points)}")
    
    # Libera memória da nuvem original
    pcd = None
    all_points = None
    all_colors = None
    gc.collect()
    
    # Salva nuvem de pontos simplificada
    logger.info(f"Salvando nuvem de pontos em {output_cloud}...")
    o3d.io.write_point_cloud(str(output_cloud), pcd_down)
    
    # Gera mesh para visualização (Alpha Shape para preservar formato)
    logger.info("Gerando mesh Alpha Shape...")
    try:
        alpha = 0.1  # Ajuste este valor conforme necessidade
        mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_alpha_shape(pcd_down, alpha)
        
        # Simplifica o mesh para visualização enquanto mantém detalhes suficientes para medição
        logger.info("Simplificando mesh...")
        target_triangles = min(500000, len(mesh.triangles))  # Ajuste conforme necessidade
        reduction_factor = target_triangles / len(mesh.triangles)
        mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=target_triangles)
        
        # Suaviza mesh para melhor aparência
        logger.info("Suavizando mesh...")
        mesh = mesh.filter_smooth_taubin(number_of_iterations=5)
        
        # Salva mesh
        logger.info(f"Salvando mesh em {output_mesh}...")
        o3d.io.write_triangle_mesh(str(output_mesh), mesh)
    except Exception as e:
        logger.error(f"Erro ao gerar mesh: {e}")
    
    # Gera planta baixa
    logger.info("Gerando planta baixa...")
    try:
        generate_floor_plan(pcd_down, output_floor_plan)
    except Exception as e:
        logger.error(f"Erro ao gerar planta baixa: {e}")
    
    elapsed_time = time.time() - start_time
    logger.info(f"Processamento concluído em {elapsed_time:.2f} segundos")

def generate_floor_plan(pcd, output_path, image_size=(800, 800), margin=50):
    """Gera uma planta baixa a partir da nuvem de pontos"""
    logger.info("Gerando planta baixa...")
    
    # Extrai pontos da nuvem
    points = np.asarray(pcd.points)
    
    # Considera apenas pontos próximos ao chão (±1m do ponto mais baixo)
    min_y = np.min(points[:, 1])
    floor_points = points[points[:, 1] < min_y + 1.0]
    
    if len(floor_points) == 0:
        logger.warning("Nenhum ponto do chão encontrado para gerar planta baixa.")
        return
    
    # Obtém coordenadas X e Z (descarta altura Y)
    x_coords = floor_points[:, 0]
    z_coords = floor_points[:, 2]
    
    # Determina limites
    x_min, x_max = np.min(x_coords), np.max(x_coords)
    z_min, z_max = np.min(z_coords), np.max(z_coords)
    
    # Cria imagem
    img = Image.new('RGB', image_size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Calcula escala para caber na imagem com margens
    width = image_size[0] - 2 * margin
    height = image_size[1] - 2 * margin
    
    x_scale = width / (x_max - x_min) if x_max > x_min else 1
    z_scale = height / (z_max - z_min) if z_max > z_min else 1
    scale = min(x_scale, z_scale)
    
    # Desenha pontos do chão
    for x, z in zip(x_coords, z_coords):
        px = margin + int((x - x_min) * scale)
        py = margin + int((z - z_min) * scale)
        draw.point((px, py), fill='black')
    
    # Salva imagem
    logger.info(f"Salvando planta baixa em {output_path}...")
    img.save(output_path)

def process_trueview(trueview_dir, output_dir):
    """Processa dados do TrueView para integração com a nuvem de pontos"""
    logger.info(f"Processando dados do TrueView: {trueview_dir}")
    
    # Verifica se a pasta existe
    if not os.path.exists(trueview_dir):
        logger.warning(f"Pasta TrueView não encontrada: {trueview_dir}")
        return
    
    # Lista todas as subpastas (cada uma contém uma cena)
    scene_folders = [f for f in os.listdir(trueview_dir) 
                    if os.path.isdir(os.path.join(trueview_dir, f))]
    
    for scene_folder in scene_folders:
        scene_path = os.path.join(trueview_dir, scene_folder)
        logger.info(f"Processando cena TrueView: {scene_folder}")
        
        # Procura pelo arquivo de configuração do cubemap
        config_files = [f for f in os.listdir(scene_path) 
                      if 'cubemap' in f and f.endswith('.json')]
        
        if not config_files:
            logger.warning(f"Arquivo de configuração do cubemap não encontrado para {scene_folder}")
            continue
        
        config_file = os.path.join(scene_path, config_files[0])
        
        # Lê o arquivo de configuração para extrair coordenadas
        try:
            with open(config_file, 'r') as f:
                config_data = json.loads(f.read())
            
            # Extrai coordenadas da câmera
            if 'camera' in config_data and 'position' in config_data['camera']:
                position = config_data['camera']['position']
                center = [position['x'], position['y'], position['z']]
                
                # Cria pasta de saída para a cena
                scene_output = os.path.join(output_dir, scene_folder)
                os.makedirs(scene_output, exist_ok=True)
                
                # Salva coordenadas
                with open(os.path.join(scene_output, "center_coordinates.txt"), "w") as f:
                    f.write(f"center = [{center[0]}, {center[1]}, {center[2]}]\n")
                
                logger.info(f"Coordenadas extraídas para {scene_folder}: {center}")
            else:
                logger.warning(f"Dados de posição não encontrados para {scene_folder}")
        
        except Exception as e:
            logger.error(f"Erro ao processar configuração do TrueView para {scene_folder}: {e}")

def main():
    """Função principal"""
    ensure_dirs()
    
    # Procura por arquivos PTS na pasta de entrada
    pts_files = list(INPUT_DIR.glob("**/*.pts"))
    
    if not pts_files:
        logger.warning(f"Nenhum arquivo PTS encontrado em {INPUT_DIR}")
        return
    
    logger.info(f"Encontrados {len(pts_files)} arquivos PTS")
    
    # Processa cada arquivo
    for pts_file in pts_files:
        process_point_cloud(pts_file, OUTPUT_DIR)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Erro: {e}", exc_info=True)