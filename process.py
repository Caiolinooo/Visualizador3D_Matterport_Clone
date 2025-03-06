#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
process.py - Processa um arquivo .pts para gerar:
  • Nuvem de pontos;
  • Mesh simplificado (via Alpha Shape e decimação);
  • Visão de planta (projeção dos pontos para uma imagem 2D).

Simula uma parte do fluxo de trabalho do Matterport.
"""

import os
import sys
import numpy as np
from PIL import Image, ImageDraw
import open3d as o3d


def load_pts(file_path):
    """
    Carrega o arquivo .pts e retorna um array Nx3.
    Supõe-se que:
      - A primeira linha seja o número de pontos (opcional)
      - As demais linhas contenham 'x y z' (mais colunas serão ignoradas)
    """
    with open(file_path, 'r') as f:
        lines = [line.strip() for line in f if line.strip() != ""]

    pts = []
    # Tenta interpretar a primeira linha como número de pontos
    try:
        n_points = int(lines[0])
        data_lines = lines[1:]
    except ValueError:
        data_lines = lines

    for line in data_lines:
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
            pts.append([x, y, z])
        except ValueError:
            continue

    data = np.array(pts, dtype=np.float64)
    return data


def compute_center(points):
    """ Calcula o centro (média) dos pontos. """
    return np.mean(points, axis=0)


def generate_mesh(points, alpha=0.1, target_triangles=1000):
    """
    Gera um mesh a partir da nuvem de pontos utilizando Alpha Shape.
    Em seguida, simplifica o mesh para reduzir a contagem de triângulos.
    
    Parâmetros:
      - points: array Nx3
      - alpha: parâmetro usado no método de Alpha Shape
      - target_triangles: número alvo de triângulos após simplificação
    Retorna:
      - mesh (open3d.geometry.TriangleMesh)
    """
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    
    try:
        mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_alpha_shape(pcd, alpha)
    except Exception as e:
        print("Erro ao gerar Alpha Shape:", e)
        mesh = o3d.geometry.TriangleMesh()
    
    mesh.compute_vertex_normals()
    
    if len(mesh.triangles) > target_triangles and target_triangles > 0:
        mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=target_triangles)
        mesh.compute_vertex_normals()
    
    return mesh


def generate_floor_plan(points, output_path, image_size=(500,500), margin=10):
    """
    Gera uma imagem representando a planta baixa.
    Os pontos são projetados para o plano XZ e mapeados para uma imagem 2D.
    
    Parâmetros:
      - points: array Nx3
      - output_path: caminho para salvar a imagem (ex.: floor_plan.png)
      - image_size: tupla (largura, altura)
      - margin: margem em pixels
    """
    # Projeta os pontos para X e Z
    proj = points[:, [0, 2]]
    min_vals = np.min(proj, axis=0)
    max_vals = np.max(proj, axis=0)
    
    # Calcula escalas
    scale_x = (image_size[0] - 2*margin) / (max_vals[0] - min_vals[0] + 1e-6)
    scale_y = (image_size[1] - 2*margin) / (max_vals[1] - min_vals[1] + 1e-6)
    
    img = Image.new("RGB", image_size, "white")
    draw = ImageDraw.Draw(img)
    
    for point in proj:
        x = int(margin + (point[0] - min_vals[0]) * scale_x)
        y = int(margin + (max_vals[1] - point[1]) * scale_y)  # Inverte eixo Y para a imagem
        radius = 1
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill="black")
    
    img.save(output_path)
    print(f"Planta baixa salva em {output_path}")


def main():
    # Define diretório base de entrada: se fornecido via argumento e for diretório, usa-o; senão, usa 'input_data'
    if len(sys.argv) > 1:
        input_base = sys.argv[1]
        if not os.path.isdir(input_base):
            print(f"{input_base} não é um diretório.")
            sys.exit(1)
    else:
        input_base = os.path.join(os.getcwd(), 'input_data')

    scans_dir = os.path.join(input_base, 'scans')
    panoramas_dir = os.path.join(input_base, 'panoramas')
    if not os.path.exists(scans_dir):
        print(f"Pasta de scans não encontrada em: {scans_dir}")
        sys.exit(1)

    output_base = os.path.join(os.getcwd(), 'output')
    if not os.path.exists(output_base):
        os.makedirs(output_base)

    pts_files = [f for f in os.listdir(scans_dir) if f.lower().endswith('.pts')]
    if not pts_files:
        print("Nenhum arquivo .pts encontrado.")
        sys.exit(1)

    for pts_file in pts_files:
        scene_name = os.path.splitext(pts_file)[0]
        print(f"\nProcessando cena: {scene_name}")
        pts_path = os.path.join(scans_dir, pts_file)

        # Carrega os pontos e aplica downsampling
        points = load_pts(pts_path)
        print(f"Pontos carregados: {points.shape[0]}")

        pcd_original = o3d.geometry.PointCloud()
        pcd_original.points = o3d.utility.Vector3dVector(points)
        voxel_size = 0.5  # ajustável conforme necessário
        down_pcd = pcd_original.voxel_down_sample(voxel_size)
        points = np.asarray(down_pcd.points)
        print(f"Pontos após downsampling: {points.shape[0]}")

        # Calcula o centro
        center = compute_center(points)
        print(f"Centro: {center}")

        # Cria pasta de saída para a cena
        scene_output = os.path.join(output_base, scene_name)
        if not os.path.exists(scene_output):
            os.makedirs(scene_output)

        # Gera o mesh simplificado
        mesh = generate_mesh(points, alpha=0.1, target_triangles=1000)
        mesh_output = os.path.join(scene_output, 'output_mesh.ply')
        o3d.io.write_triangle_mesh(mesh_output, mesh)
        print(f"Mesh salvo em {mesh_output}")

        # Gera a planta baixa
        floor_plan_output = os.path.join(scene_output, 'floor_plan.png')
        generate_floor_plan(points, floor_plan_output, image_size=(500,500), margin=10)

        # Salva a nuvem de pontos
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        cloud_output = os.path.join(scene_output, 'output_cloud.ply')
        o3d.io.write_point_cloud(cloud_output, pcd)
        print(f"Nuvem de pontos salva em {cloud_output}")

        # Salva as coordenadas do centro
        coord_output = os.path.join(scene_output, 'center_coordinates.txt')
        with open(coord_output, 'w') as f:
            f.write(f"Centro: {center.tolist()}\n")
        print(f"Coordenadas do centro salvas em {coord_output}")

        # Verifica e copia arquivo de panorama, se existir
        if os.path.exists(panoramas_dir):
            for ext in ['.jpg', '.jpeg', '.png']:
                pano_file = scene_name + ext
                pano_path = os.path.join(panoramas_dir, pano_file)
                if os.path.exists(pano_path):
                    import shutil
                    dest_path = os.path.join(scene_output, pano_file)
                    shutil.copy2(pano_path, dest_path)
                    print(f"Panorama {pano_file} copiado para {scene_output}")
                    break

        # Copia o arquivo .pts original para a pasta de saída
        import shutil
        dest_pts = os.path.join(scene_output, pts_file)
        shutil.copy2(pts_path, dest_pts)
        print(f"Arquivo .pts {pts_file} copiado para {scene_output}")

    # Após processar todas as cenas, gerar sumário dos resultados para integração com front end
    summary = {}
    for scene in os.listdir(output_base):
        scene_path = os.path.join(output_base, scene)
        if os.path.isdir(scene_path):
            files = os.listdir(scene_path)
            summary[scene] = files
    import json
    summary_path = os.path.join(output_base, 'summary.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=4)
    print(f"Summary JSON salvo em {summary_path}")


if __name__ == '__main__':
    main()