<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:Lgshds="http://leica-geosystems.com/Lgshds" version="1.0">
  <xsl:template match="/Lgshds:CubeMap">
    <xsl:variable name="neighborCount">
      <xsl:value-of select="count(//Lgshds:Neighbor)"/>
    </xsl:variable>

    <xsl:variable name="neighborRows">
      <xsl:value-of select="$neighborCount*4+1"/>
    </xsl:variable>
    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="MetaData.css" >
        </link>
        <title>
          CycloneX: <xsl:value-of select="/Lgshds:Title" /> Meta Data
        </title>
      </head>
      <body>
        <table cellpadding="0" cellspacing="0" border="2">
          <tr>
            <td align="center" colspan="4">
              <input type="button" title="Close Window" size="24" value="Close Window" onClick="window.close();"> </input>
            </td>
          </tr>
          <!-- UID -->
          <tr style="height:24px;">
            <td class="categoryTitle">
              UID
            </td>
            <td colspan="3" class="itemValueA">
              <xsl:value-of select="Lgshds:Uid"/>
            </td>
          </tr>
          <!-- VERSION NUMBER -->
          <tr style="height:24px">
            <td class ="categoryTitle">
              Build Version
            </td>
            <td colspan="3" class="itemValueA">
              <xsl:value-of select="Lgshds:Build"/>
            </td>
          </tr>
          <!-- alphaChannel -->
          <tr style="height:24px;">
            <td class="categoryTitle">
              Background Dim
            </td>
            <td colspan="3" class="itemValueA">
              <xsl:value-of select="Lgshds:alphaChannel"/>
            </td>
          </tr>
          
          <!-- Scan Meta -->
          <tr>
            <td rowspan="8" class="categoryTitle">
              Scan Meta
            </td>
            <td colspan="2" class="itemName">Database Name:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:databaseName"/>
            </td>
          </tr>
          
          <tr>
            <td colspan="2" class="itemName">Scan World Path:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:scanWorldPath"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Scan Name:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:scanName"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Scanner Model:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:scannerModel"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Scanner ID:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:scannerId"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Date:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:scanDate"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Creation Date:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:creationDate"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Point Count:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:ScanMeta/Lgshds:pointCount"/>
            </td>
          </tr>

          <!-- Coordinate System -->
          <tr>
            <xsl:choose>
              <xsl:when test="Lgshds:CoordinateSystem/Lgshds:azimuth">
                <td rowspan="5" class="categoryTitle">
                  Coordinate System
                </td>
              </xsl:when>
              <xsl:otherwise>
                <td rowspan="4" class="categoryTitle">
                  Coordinate System
                </td>
              </xsl:otherwise>
            </xsl:choose>
            
            <td colspan="2" class="itemNameA">Up Direction:</td>
            <td class="itemValueA">
              <xsl:if test="Lgshds:CoordinateSystem/Lgshds:UpDirection = 0">
                Z Axis
              </xsl:if>
              <xsl:if test="Lgshds:CoordinateSystem/Lgshds:UpDirection = 1">
                Y Axis
              </xsl:if>
            </td>
          </tr>
          <xsl:if test="Lgshds:CoordinateSystem/Lgshds:azimuth">
            <tr>
              <td colspan="2" class="itemNameA">Azimuth:</td>
              <td class="itemValueA">
                <xsl:value-of select="Lgshds:CoordinateSystem/Lgshds:azimuth"/>
              </td>
            </tr>        
          </xsl:if>            
          <tr>
            <td colspan="2" class="itemNameA">Center X:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:CoordinateSystem/Lgshds:centerPointX"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Center Y:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:CoordinateSystem/Lgshds:centerPointY"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Center Z:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:CoordinateSystem/Lgshds:centerPointZ"/>
            </td>
          </tr>

          <!-- Panorama Meta -->
          <tr>
            <td rowspan="16" class="categoryTitle">
              Panorama Meta
            </td>
            <td colspan="2" class="itemName">Version:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:PanoramaMeta/Lgshds:version"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Distance Unit:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:PanoramaMeta/Lgshds:distanceUnit"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Angular Unit:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:PanoramaMeta/Lgshds:angularUnit"/>
            </td>
          </tr>
          <xsl:if test="Lgshds:PanoramaMeta/Lgshds:version = 1.0">
            <xsl:for-each select="Lgshds:PanoramaMeta/Lgshds:lods/Lgshds:lod">
              <tr>
                <td rowspan="3" class="subCategoryTitle">
                  LOD <xsl:value-of select="Lgshds:size"/>
                </td>
                <td class="itemName">Size:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:size"/>
                </td>
              </tr>
              <tr>
                <td class="itemName">Max Point Error:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:maxPointError"/>
                </td>
              </tr>
              <tr>
                <td class="itemName">Point Count:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:pointCount"/>
                </td>
              </tr>
            </xsl:for-each>
          </xsl:if>

          <xsl:if test="Lgshds:PanoramaMeta/Lgshds:version >= 1.1">


            <xsl:for-each select="Lgshds:PanoramaMeta/Lgshds:lods2/Lgshds:lod">
              <tr>
                <td rowspan="3" class="subCategoryTitle">
                  LOD <xsl:value-of select="Lgshds:size"/>
                </td>
                <td class="itemName">Size:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:size"/>
                </td>
              </tr>
              <tr>
                <td class="itemName">Max Point Error:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:maxPointError"/>
                </td>
              </tr>
              <tr>
                <td class="itemName">Point Count:</td>
                <td class="itemValue">
                  <xsl:value-of select="Lgshds:pointCount"/>
                </td>
              </tr>
            </xsl:for-each>
          </xsl:if>
          
          <tr>
            <td colspan="2" class="itemName">Has Point Data:</td>
            <td class="itemValue">
              <xsl:value-of select ="Lgshds:PanoramaMeta/Lgshds:hasPointData"/>
            </td>
          </tr>

          <!-- View Defaults -->
          <tr>
            <td rowspan="5" class="categoryTitle">View Defaults</td>
            <td colspan="2" class="itemNameA">Distance Unit:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:ViewDefaults/Lgshds:distanceUnit"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Angular Unit:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:ViewDefaults/Lgshds:angularUnit"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">FOV:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:CoordinateSystem/Lgshds:fieldOfView"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Azimuth:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:ViewDefaults/Lgshds:azimuth"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Elevation:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:ViewDefaults/Lgshds:elevation"/>
            </td>
          </tr>

          <!-- LOD Meta -->
          <tr>
            <td rowspan="3" class="categoryTitle">LOD Meta</td>
            <td colspan="2" class="itemName">Size:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:LODMeta/Lgshds:lodSize"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Max Point Error:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:LODMeta/Lgshds:maxPointError"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemName">Point Count:</td>
            <td class="itemValue">
              <xsl:value-of select="Lgshds:LODMeta/Lgshds:pointCount"/>
            </td>
          </tr>
          
          <!-- Site Map -->
          <tr style="height:24px;">
            <td class="categoryTitle">
              Site Map
            </td>
            <td colspan="3" class="itemValueA">
              <xsl:value-of select="Lgshds:SiteMap/@URL"/>
            </td>
          </tr>
          
          <!-- Neighbor TruViews -->
          <tr>
            <td rowspan="{$neighborRows}" class="categoryTitle">Neighbors</td>
         
          </tr>

          <xsl:for-each select="Lgshds:Neighbors/Lgshds:Neighbor">
            <tr>
              <td rowspan="4" class="subCategoryTitle">
                <xsl:value-of select="@Name"/>
              </td>
              <td class="itemName">X:</td>
              <td class="itemValue">
                <xsl:value-of select="@X"/>
              </td>
            </tr>
            <tr>
              <td class="itemName">Y:</td>
              <td class="itemValue">
                <xsl:value-of select="@Y"/>
              </td>
            </tr>
            <tr>
              <td class="itemName">Z:</td>
              <td class="itemValue">
                <xsl:value-of select="@Z"/>
              </td>
            </tr>
            <tr>
              <td class="itemName">URL:</td>
              <td class="itemValue">
                <xsl:value-of select="@URL"/>
              </td>
            </tr>
          </xsl:for-each>
          
          <!-- Owner Info -->
          <tr>
            <td rowspan="8" class="categoryTitle">Owner Info</td>
            <td colspan="2" class="itemNameA">Company:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:company"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Comapny URL:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:companyUrl"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Contact:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:contact"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Copyright:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:copyright"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Project Url:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:projectUrl"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Publisher:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:publisher"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Publisher Url:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:publisherUrl"/>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="itemNameA">Publisher Email:</td>
            <td class="itemValueA">
              <xsl:value-of select="Lgshds:OwnerInfo/Lgshds:publisherEmail"/>
            </td>
          </tr>
          
        </table>
        </body>
    </html>
  </xsl:template>

</xsl:stylesheet> 
