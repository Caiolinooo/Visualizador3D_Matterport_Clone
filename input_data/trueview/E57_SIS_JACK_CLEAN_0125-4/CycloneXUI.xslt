<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:cx="http://www.leica-geosystems.com/namespaces/TruView" version="1.0">
  <xsl:template match="/">

    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="CycloneXUI.css" >
        </link>
        <script language="javascript" type="text/jscript" src="CycloneXUI.js">
        </script>
        <title>
          TruView
        </title>

        <script type="text/javascript">

          window.onscroll = scroll;        
        </script>
      </head>

      <body>
        <!-- =========================  -->
        <!-- =    EVENT CAPTURES     =  -->
        <!-- =========================  -->

        <xsl:if test="/cx:Dataset/@ProgressBox = 'true'">
          <script language="javascript" for="CX_Control" event="DownloadInProgress()">
            showProgress( CX_Control.GetDownladProgress() );
          </script>

          <script language="javascript" for="CX_Control" event="DownloadComplete()">
            showProgress( 100.0 );
          </script>
        </xsl:if>

        <script language="javascript" for="CX_Control" event="ViewLockChanged( flag )">
          viewLockChanged(flag);
        </script>

        <script language="javascript" for="CX_Control" event="Mark3DAdded( id )">
          newMark3D( id );
        </script>

        <script language="javascript" for="CX_Control" event="Shape2DAdded( drwID )">
          newShape( drwID );
        </script>

        <script language="javascript" for="CX_Control" event="Shape2DRemoved( drwID )">
          shapeRemoved( drwID );
        </script>

        <script language="javascript" for="CX_Control" event="Select2DChanged( drwID )">
          selection2D( drwID );
        </script>

        <script language="javascript" for="CX_Control" event="CameraChanged()">
          deactivateSelectedView()
        </script>

        <script language="javascript" for="CX_Control" event="MouseEvent( mouseEvent, x, y )">
          mouseDblClick( mouseEvent, x, y );
        </script>

        <script language="javascript" for="CX_Control" event="ViewAdded( viewName, viewID )">
          addView( viewName, viewID );
        </script>
       
        <script language="javascript" for="CX_Control" event="PointPicked( x, y, z )">
          managePicking(x,y,z);
        </script>

        <script language="javascript" for="CX_Control" event="MenuEvent ( m )">
          menuEvent( m );
        </script>
        <script language="javascript" for="CX_Control" event="Shape2DDelete(  shapeid )">
          shape2DDelete(shapeid);
        </script>

        <script language="javascript" for="CX_Control" event="Mark3DDeleted( id )">
          deleteMark3D( id );
        </script>

        <script language="javascript" for="CX_Control" event="Stop2DEdit()">
          stop2DEdit();
        </script>

        <script language="javascript" for="CX_Control" event="Stop2DAdd()">
          stop2DAdd();
        </script>

        <script language="javascript" for="CX_Control" event="StopMeasure()">
          stopMeasure();
        </script>

        <script language="javascript" for="CX_Control" event="UpdateText()">
          updateText();
        </script>

        <script language="javascript" for="CX_Control" event="OpenNewTruView( truViewName )">
          openNewTruView( truViewName );
        </script>

        <script language="javascript"  for="CX_Control" event="UpdateNeighborList">
          updateNeighborsList();
        </script>

        <script language="javascript"  for="CX_Control" event="UpdateNeighborRanges">
          updateNeighborRanges();
        </script>

        <script language="javascript"  for="CX_Control" event="NewAPIAdded (index )">
          if ( controlLoading )
            newApiAdded( index );
        </script>
        
        <script language="javascript" for="CX_Control" event="ControlInitialized()">
          if ( !controlLoading )
          {
          controlLoading = true;
          loadingStarted = true;
          CX_Control.src = "CubeMapMeta.xml";
          activateTab('Measure');
          CX_Control.LoadMarks(markupFilename, false ); // Do not force server version of markup to load
          if ( CX_Control.MarksLocal )
            MarkupFileNameText.innerHTML = "Client side marks: " + markupFilename;
          else
            MarkupFileNameText.innerHTML = "Server side marks: " + markupFilename;
          Mark3DXNameTxt.innerHTML = "&#916;X:";
          Mark3DYNameTxt.innerHTML = "&#916;Y:";
          Mark3DZNameTxt.innerHTML = "&#916;Z:";
          updateToolBar();
          setMaxNeighborsFromCookie();
          }
        </script>
     
        <table style="width:100%; height:100%;" cellpadding="0" cellspacing="0" border="0">
          <tr style="height:24px;">
            <td rowspan="2" class="visibleTd"  valign="middle" id="leftTitle">
              <table cellpadding="0" cellspacing="10" border="0">
                <tr>
                  <td>
                    <img src="Images/trueview_logo.jpg" border="0" hspace="0" vspace="0"/>
                  </td>
                  <td align="center" valign="bottom">
			<span id="ClickableSpan" onmouseover="Pointer()" onmouseout="DefaultCursor()">
			<u onClick="showTruViewAbout()" onmouseover="this.T_WIDTH=180;return escape('TruView client and data versions');" style="font-size: 9pt; color:#0000FF; align:center">
			Version</u>
			</span>
                  </td>
                </tr>
              </table>
            </td>
            <td rowspan="2" class="hiddenTd"  valign="middle" id="tempTitle">
              <table cellpadding="0" cellspacing="10" border="0">
                <tr>
                  <td>
                    <img src="Images/trueview_logo.jpg" border="0" hspace="0" vspace="0"/>
                  </td>
                  <td align="center" valign="bottom">
			<span id="ClickableSpan" onmouseover="Pointer()" onmouseout="DefaultCursor()">
			<u onClick="showTruViewAbout()" onmouseover="this.T_WIDTH=180;return escape('TruView client and data versions');" style="font-size: 9pt; color:#0000FF; align:center">
			Version</u>
			</span>
                  </td>
                </tr>
              </table>
            </td>            
            <td class="toolbarTitle" valign="bottom">
              <span class="toolbarTitleTab"> Controls </span>
            </td>
            <td class="toolbarTitle" valign="bottom">
              <span class="toolbarTitleTab"> 2D Markups </span>
            </td>
            <td id="measurementToolbarTitle"  class="toolbarTitle" valign="bottom">
              <span class="toolbarTitleTab"> Measurements/Hotlink </span>
            </td>
 
            <td class="toolbarTitle" valign="bottom">
              <span class="toolbarTitleTab"> About </span>
            </td>
          </tr>
          <tr>
            <td class="toolbar">
              <span onmouseover="SiteMapBt.src='Images/HomeHover.png';" onmouseout="SiteMapBt.src='Images/HomeOff.png';">
                <img class="iconToolbarButton" id="SiteMapBt" src="Images/HomeOff.png"  onmouseover="this.T_WIDTH=100;return escape('Open site map');" onclick="OpenSiteMap()" alt="Open site map"/>
              </span>
              <span onmouseover="PrintBt.src='Images/PrintHover.png';" onmouseout="PrintBt.src='Images/PrintOff.png';">
                <img class="iconToolbarButton" id="PrintBt" src="Images/PrintOff.png"  onmouseover="this.T_WIDTH=40;return escape('Print');" onclick="print()" alt="Print"/>
              </span>
            <!--   <span onmouseover="if (leftPaneVisible) HideShowBt.src='Images/HideHover.png'; else HideShowBt.src='Images/ShowHover.png'" onmouseout="if (leftPaneVisible) HideShowBt.src='Images/HideOff.png'; else HideShowBt.src='Images/ShowOff.png'">
               <img class="iconToolbarButton" id="HideShowBt" src="Images/HideOff.png"  onmouseover="this.T_WIDTH=110;return escape('Hide/Show left pane');" onclick="hideShowLeft()" alt="Hide/Show left pane"/>
              </span>-->
              <img class="iconToolbarButton" id="sepBt" src="Images/Sep.jpg" alt=""/>
              
              <span onmouseover="viewBt.src='Images/ViewHover.png';" onmouseout="viewOut()">
                <img class="iconToolbarButton" id="viewBt" src="Images/ViewOff.png" onclick="viewClick();" onmouseover="this.T_WIDTH=110;return escape('View/Hyperlink Mode')" alt="View"/>
              </span>
              <span onmouseover="lockBt.src='Images/MarkupHover.png';" onmouseout="markupOut()">
                <img class="iconToolbarButton" id="lockBt"  src="Images/MarkupOff.png" onclick="lockView();" onmouseover="this.T_WIDTH=75;return escape('Markup Mode')" alt="Markup"/>
              </span>
              <span onmouseover="rotBt.src='Images/RotateHover.png';" onmouseout="rotateOut()">
                <img class="iconToolbarButton" id="rotBt"    src="Images/RotateOn.png" onclick="rotClick();" onmouseover="this.T_WIDTH=90;return escape('Pan/Zoom Mode')" alt="Pan/Zoom"/>
              </span>
              <img class="iconToolbarButton" id="sepBt" src="Images/Sep.jpg" alt=""/>

              <span onmouseover="zoomHover();" onmouseout="if(mode == 2) zoomBt.src='Images/ZoomOff.png'; else zoomBt.src = 'Images/ZoomDisable.png';">
                <img class="iconToolbarButton" id="zoomBt" src="Images/ZoomOff.png" onmouseover="this.T_WIDTH=40;return escape('Zoom')" onmousedown="if(mode == 2) panZoomClick(this);" onmouseup="if(mode == 2) stopMove(this);" alt="Zoom In/Out"/>
              </span>
              <span onmouseover="if(mode == 2) panBt.src='Images/PanHover.png'; else panBt.src = 'Images/PanDisable.png';" onmouseout="if(mode == 2) panBt.src='Images/PanOff.png'; else panBt.src='Images/PanDisable.png';">
                <img class="iconToolbarButton" id="panBt" src="Images/PanOff.png" onmouseover="this.T_WIDTH=30;return escape('Pan')" onmousedown="if(mode == 2) panZoomClick(this);" onmouseup="if(mode == 2) stopMove(this);" alt="Pan"/>
              </span>
              <span onmouseover="hideScanWorldsBt.src='Images/TriangHover.png';" onmouseout="showHideScanWorldsOut()">
                <img class="iconToolbarButton" id="hideScanWorldsBt" src="Images/TriangOff.png" onclick="OnHideNeighbor();" onmouseover="this.T_WIDTH=110;return escape('Show/Hide Neighbor ScanWorlds')" />
              </span>

            </td>
            <td class="toolbar">
              <span onmouseover="LineBt.src='Images/LineHover.png';" onmouseout="if(markupMode==0) LineBt.src='Images/LineOn.png'; else LineBt.src='Images/LineOff.png';">
                <img class="iconToolbarButton" id="LineBt" src="Images/LineOff.png" onmouseover="this.T_WIDTH=80;return escape('Arrow Line');" onclick="addShape( 'Line' );" alt="Draw a line arrow"/>
              </span>
              <span onmouseover="CircBt.src='Images/CircHover.png';" onmouseout="if(markupMode==1) CircBt.src='Images/CircOn.png'; else CircBt.src='Images/CircOff.png';">
                <img class="iconToolbarButton" id="CircBt" src="Images/CircOff.png" onmouseover="this.T_WIDTH=40;return escape('Circle');" onclick="addShape( 'Circle' );" alt="Draw a circle"/>
              </span>
              <span onmouseover="RectBt.src='Images/RectHover.png';" onmouseout="if(markupMode==2) RectBt.src='Images/RectOn.png'; else RectBt.src='Images/RectOff.png';">
                <img class="iconToolbarButton" id="RectBt" src='Images/RectOff.png' onmouseover="this.T_WIDTH=60;return escape('Rectangle');" onclick="addShape( 'Rectangle' );" alt="Draw a rectangle"/>
              </span>
              <span onmouseover="TextBt.src='Images/TextHover.png';" onmouseout="if(markupMode==3) TextBt.src='Images/TextOn.png'; else TextBt.src='Images/TextOff.png';">
                <img class="iconToolbarButton" id="TextBt" src='Images/TextOff.png' onmouseover="this.T_WIDTH=30;return escape('Text');" onclick="addText( );" alt="Enter a note"/>
              </span>

              <span onmouseover="PointBt.src='Images/CoordHover.png';" onmouseout="pointOut()">
                <img class="iconToolbarButton" id="PointBt" src="Images/CoordOff.png"  onmouseover="this.T_WIDTH=100;return escape('Markup Coordinate');" onclick="addShape( 'Position2D' );" alt="Add a point position label"/>
              </span>
              <span onmouseover="LengthBt.src='Images/DimHover.png';" onmouseout="lenOut()">
                <img class="iconToolbarButton" id="LengthBt" src="Images/DimOff.png"  onmouseover="this.T_WIDTH=100;return escape('Markup Distance');" onclick="addShape( 'Distance2D' );" alt="Add a distance label"/>
              </span>
            </td>
            <td id="measurementToolbar"  class="toolbar">
              <span onmouseover="positionOver()" onmouseout="positionOut();">
                <img class="iconToolbarButton" id="PositionBt" src="Images/xyzOff.png"  onmouseover="this.T_WIDTH=110;return escape('Measure Coordinate');" onclick="if(!lockMeasure) pickVertex();" alt="Measure a point position"/>
              </span>
              <span onmouseover="distOver()" onmouseout="distOut()">
                <img class="iconToolbarButton" id="DistanceBt" src="Images/RulerOff.png"  onmouseover="this.T_WIDTH=100;return escape('Measure Distance');" onclick="if(!lockMeasure) pickDistance();" alt="Measure distance"/>
              </span>
              <span onmouseover="hotLinkOver()" onmouseout="hotLinkOut()">
                <img class="iconToolbarButton" id="HotlinkBt" src="Images/HotlinkOff.png"  onmouseover="this.T_WIDTH=73;return escape('Place Hotlink');" onclick="if(!lockMeasure) placeHotLink();"/>
              </span>
            </td>           
            
            <td class="toolbar">
              <span onmouseover="InfoBt.src='Images/InfoHover.png';" onmouseout="InfoBt.src='Images/Info.png';">
                <img class="iconToolbarButton" id="InfoBt" src="Images/Info.png"  onmouseover="this.T_WIDTH=120;return escape('Meta data information');" onclick="showInfo();" alt="Information"/>
              </span>
              <span onmouseover="HelpBt.src='Images/HelpHover.png';" onmouseout="HelpBt.src='Images/Help.png';">
                <img class="iconToolbarButton" id="HelpBt" src="Images/Help.png"  onmouseover="this.T_WIDTH=30;return escape('Help');" onclick="showTruViewHelp();" alt="Help"/>
              </span>
              <span onmouseover="AboutBt.src='Images/AboutHover.png';" onmouseout="AboutBt.src='Images/About.png';">
                <img class="iconToolbarButton" id="AboutBt" src="Images/About.png"  onmouseover="this.T_WIDTH=40;return escape('About');" onclick="showTruViewAbout();" alt="About"/>
              </span>
            </td>
          </tr>
          <tr>
            <td style="width:210px; visibility:visible" valign="top" align="center" id="leftPanel">
              <table style="width:100%; margin-left:2px; margin-top:2px;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td id="ViewsTab"   class="tab" style="width:72px;"  onmouseout="ViewsTab.bgColor=tabInactiveColor;"    onmouseover="ViewsTab.bgColor=tabHilightColor;"   onclick="activateTab('Views',true)">View</td>
                  <td id="MarkupTab"  class="tab" style="width:70px;"  onmouseout="MarkupTab.bgColor=tabInactiveColor;"   onmouseover="MarkupTab.bgColor=tabHilightColor;"  onclick="activateTab('Markup',true)" >Markup</td>
                  <td id="MeasureTab" class="tab" style="width:70px;"  onmouseout="MeasureTab.bgColor=tabInactiveColor;"  onmouseover="MeasureTab.bgColor=tabHilightColor;" onclick="activateTab('Measure',true)">Measure</td>
                </tr>
              </table>
              <div class="UIPanel" id="panelPanel">

                <!-- =========================  -->
                <!-- =     VIEWS PANEL       =  -->
                <!-- =========================  -->
                <div id="ViewsPanel" class="UIPanelVisible">
                  <center>
                    <select size="9" id="ViewList" class="selectionBox" onchange="viewSelection()" ondblclick="viewDClick()" onkeydown="ViewKeyHandle(event)"></select>

                    <table id="ViewPropPanel" disabled="true" class="PropertyPanel" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="2" style="background-color: #d0d0d0;">
                          <b>View Properties:</b>
                        </td>
                      </tr>
                      <tr>
                        <td disabled="true" class="PropertyName">Created:</td>
                        <td disabled="true" class="PropertyValue">
                          <input id="ViewCreatedTxt" class="PropertyValueSpecial" type="text"></input>
                        </td>
                      </tr>
                      <tr>
                        <td disabled="true" class="PropertyName">User:</td>
                        <td disabled="true" class="PropertyValue">
                          <input id="ViewUserTxt" class="PropertyValueSpecial" size="16" type="text"></input>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName">Name:</td>
                        <td class="PropertyValue">
                          <input id="ViewNameInput" class="PropertyValueSpecial" type="text" size="16"></input>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" colspan="2">
                          <input type="button" title="delete the selected view" value="Delete" onClick="ViewDelete();"> </input>
                          <input type="button" value="Update" title="Change the view name" onClick="ViewRename(ViewNameInput.value);"> </input>
                        </td>
                      </tr>
                    </table>
                  </center>
                </div>

                <!-- =========================  -->
                <!-- =     MARKUP PANEL      =  -->
                <!-- =========================  -->
                <div id="MarkupPanel"  class="UIPanelInvisible">
                  <center>


                    <div class="sectionTitle">
                      <table style="width:100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div class="iconButton" onclick="prevView();">&lt;</div>
                          </td>
                          <td id="ViewNameTitle" style="width:95%; text-align:center;">
                          </td>
                          <td>
                            <div class="iconButton" onclick="nextView();">&gt;</div>
                          </td>
                        </tr>

                      </table>
                    </div>


                    <select size="8" id="MarkupList" class="selectionBox" onchange="shapeSelection()" onkeydown="KeyHandle(event)"></select>
                    
                    <table id="MarkupPropPanel" class="PropertyPanel" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td colspan="2" style="background-color: #d0d0d0;">
                          <b>Markup Properties:</b>
                        </td>
                      </tr>
                      <tr>
                        <td disabled="true" class="PropertyName">Created:</td>
                        <td disabled="true" class="PropertyValue" >
                          <span id="shapeCreatedTxt" class="PropertyValue" style="width:110px;"  type="text"></span>
                        </td>
                      </tr>
                      <tr>
                        <td disabled="true" class="PropertyName">User:</td>
                        <td disabled="true" class="PropertyValue" >
                          <span id="shapeUserTxt" class="PropertyValue" style="width:110px;"  type="text"></span>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName" id="shapeUnitName" style="width:110px;">Unit:</td>
                        <td class="PropertyValue">
                          <select class="PropertyValue" id="shapeUnitSel" size="1" onchange="shapeUnitChanged()">
                            <!--<option value="0">Centimeters</option>
                            <option value="1">Meters</option>
                            <option value="10">Inches</option>
                            <option value="20">Feet</option>-->
                            <option value="0">Meters</option>
                            <option value="1">Centimeters</option>
                            <option value="10">Feet</option>
                            <option value="20">Inches</option>
                            <option value="30">US Survey Feet</option>
                            <option value="40">US Survey Inches</option>
                            <option value="50">Yards</option>
                          </select>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName">Color:</td>
                        <td class="PropertyValue" valign="top">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <span id="shapeColorTxt" class="PropertyValue" style="width:80px;"  type="text"></span>
                              </td>
                              <td>
                                <input id="shapeColorBt" value="..."  type="button" onclick="changeColorShape()"></input>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName">Fill Color:</td>
                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <span id="shapeFillColorTxt" class="PropertyValue" style="width:80px;" type="text"></span>
                              </td>
                              <td>
                                <input id="shapeFillColorBt" value="..."  type="button" onclick="changeFillColorShape()"></input>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName">Transparency:</td>
                        <td class="PropertyValue">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <input id="shapeAlphaTxt" class="PropertyValue" style="width:80px;" type="text" onBlur="changeAlphaShape()"></input>
                              </td>
                              <td>
                                <td class="PropertyName">%</td>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName" id="lineOrText">Line Thickness:</td>

                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td >                                
                                <input id="shapeLineWidthTxt" class="PropertyValueSpecial" type="text" onBlur="changeLineThincknessShape()" onkeyup="textChanged()" />
                                <textarea id="textContent" class="PropertyValueHidden"  row="5"  onkeyup="textChanged()"></textarea>
                              </td>
                              
                            </tr>                            
                          </table>
                        </td>                        
                      </tr>
                      <tr>
                        <td id="shapeFontSize"  class="PropertyName">Font Size:</td>
                        <td >
                          <input id="shapeFontSizeTxt" class="PropertyValue" style="width:110px;" type="text" onBlur="changeFontSizeShape()"></input>
                        </td>
                      </tr>
                      <tr>
                        <td class="PropertyName">Link:</td>
                        <td class="PropertyValue"  >
                          <table  width="100%" cellpadding="0" cellspacing="0" border="0">
                            <td>
                              <input id="shapeLinkTxt" style="width:80px;" class="PropertyValue" type="text" onBlur="changeLinkShape()"></input>
                            </td>
                            <td align="center">
                              <input type="button" title="Browse" id="browseForFile" value="..." onclick="browseForFile()"></input>
                            </td>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" colspan="2">
                          <input type="button" title="Delete selected markup" value="Delete" onClick="currentShapeDelete();"> </input>
                          <input type="button" title="Use default properties to reset the selected markup" id="resetShapeProperties" value="Reset" onclick="resetCurrentShape();"></input>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" colspan="2">
                          <input type="button" title="Set the current property settings as default" id="setAsDefaultShapeProperties" value="Set As Default" onclick="setCurrentShapeAsDefault();"></input>
                        </td>
                      </tr>

                    </table>

                  </center>
                </div>

                <!-- =========================  -->
                <!-- =     MEASURE PANEL     =  -->
                <!-- =========================  -->
                <div id="MeasurePanel" class="UIPanelInvisible">
                  <select size="6" id="Mark3DList" class="selectionBox" onchange="mark3DSelection()" ondblclick="mark3DDClick()"></select>

                  <table id="Mark3DPropPanel" disabled="true" class="PropertyPanel" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td colspan="2" style="background-color: #d0d0d0;">
                        <b>Measure Properties:</b>
                      </td>
                    </tr>
                    <tr>
                      <td disabled="false" class="PropertyName">Type:</td>
                      <td disabled="false" class="PropertyValue"  style="width:110px;">
                        <span class="PropertyValue" id="Mark3DTypeTxt"></span>
                      </td>
                    </tr>
                    <tr>
                      <td class="PropertyName">Color:</td>
                      <td class="PropertyValue" valign="middle" >
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td>
                              <span class="PropertyValue" id="Mark3DColorCell" style="width:80px;"></span>
                            </td>
                            <td>
                              <input id="mark3DColorBt" value="..."  type="button" class="PanelButton" onclick="changeMark3DColor();"></input>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="PropertyName">Unit:</td>
                      <td class="PropertyValue">
                        <select class="PropertyValue" id="Mark3DUnitSel" size="1" onchange="mark3DUnitChanged()">
                          <!--<option value="0">Centimeters</option>
                          <option value="1">Meters</option>
                          <option value="10">Inches</option>
                          <option value="20">Feet</option>-->
                          <option value="0">Meters</option>
                          <option value="1">Centimeters</option>
                          <option value="10">Feet</option>
                          <option value="20">Inches</option>
                          <option value="30">US Survey Feet</option>
                          <option value="40">US Survey Inches</option>
                          <option value="50">Yards</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td disabled="false" class="PropertyName" id="Mark3DDistNameTxt">Distance: </td>
                      <td disabled="false" class="PropertyValue"  style="width:110px;">
                        <span class="PropertyValue" id="Mark3DDistTxt"></span>
                      </td>
                    </tr>
                    <tr>
                      <td disabled="false" class="PropertyName">
                        <div id="Mark3DXNameTxt" style="overflow:hidden;"></div>
                      </td>
                      <td disabled="false" class="PropertyValue"  style="width:110px;">
                        <span class="PropertyValue" id="Mark3DXTxt"></span>
                      </td>
                    </tr>
                    <tr>
                      <td disabled="false" class="PropertyName">
                        <div id="Mark3DYNameTxt" style="overflow:hidden;"></div>
                      </td>
                      <td disabled="false" class="PropertyValue"  style="width:110px;">
                        <span class="PropertyValue" id="Mark3DYTxt"></span>
                      </td>
                    </tr>
                    <tr>
                      <td disabled="false" class="PropertyName">
                        <div id="Mark3DZNameTxt" style="overflow:hidden;"></div>
                      </td>
                      <td disabled="false" class="PropertyValue"  style="width:110px;">
                        <span class="PropertyValue" id="Mark3DZTxt"></span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" colspan="2">
                        <input type="button" title="Set the current properties as default" id="setAsDefaultMeasure" value="Set As Default" onclick="setCurrentMeasureAsDefault();"></input>
                      </td>
                    </tr>
                  </table>
                </div>

              </div>

              <!-- =========================  -->
              <!-- =    SAVE/LOAD PANEL    =  -->
              <!-- =========================  -->
              <xsl:if test="/cx:Dataset[@SaveMarkBox = 'true']">
                <div id="SaveLoadMarkupPanel" class="UIPanel" style="height:60px; margin-top:2px;">
                  <table class="PropertyPanel" style="margin-top:5px;" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #d0d0d0;">
                        <b>Markup Data:</b>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="height:5px;">
                        <!--<input id="MarkupFileNameInput" type="file" style="visibility: hidden; display:none;"  title="select the XML file to store markup data" size="16"></input> -->
                        <div id="MarkupFileNameText" style="overflow:hidden; text-align:center; width:190px;"></div>
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <table style="width:100%;">
                          <tr>
                            <td align="right" >
                              <input id="LoadMarkupBt" title="Append a XML markup file" class="PanelButton" value="Import"  type="button" style="width:60px" onclick="loadMarkup()"></input>
                            </td>
                            <td align="left" >
                              <input id="SaveMarkupBt" title="Save markups into a XML file" class="PanelButton" value="Export"  type="button" style="width:60px" onclick="saveMarkup()"></input>
                            </td>
                          </tr>
                        </table>
                        <table style="width:100%;">
                          <tr>
                            <td align="center" >
                              <input id="LoadPresavedMarkupBt" title="Retrieve markup file from Server" class="PanelButton" value="Load From Server"  type="button" style="width:120px"  onclick="loadPresavedMarkup(true)"></input>
                            </td>
                          </tr>
                        </table>
                        <table style="width:100%;">
                          <tr>
                            <td align="center" >
                              <input id="LoadPresavedClientMarkupBt" title="Retrieve markup file from Client" class="PanelButton" value="  Load Local  "  type="button" style="width:120px" onclick="loadPresavedMarkup(false)"></input>
                            </td>
                          </tr>
                        </table>
                        <table style="width:100%;">
                          <tr>
                            <td align="center" >
                              <input id="ClearMarkupBt" title="Clear all views" class="PanelButton" value="  Clear All  "  type="button" style="width:120px" onclick="clearMarkup( 0 )"></input>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </div>
              </xsl:if>
              <xsl:if test="/cx:Dataset[@SaveMarkBox != 'true']">
                <div id="MarkupFileNameText" style="visibility:hidden; overflow:hidden; text-align:center; width:190px;"></div>
              </xsl:if>

              <!-- =========================  -->
              <!-- =    Neighbor TruView Pane;     =  -->
              <!-- =========================  -->
              <div id="neighborPanel" class="UIPanelInvisible" style="height:80px; margin-top:2px;">
                <table class="PropertyPanel" style="margin-top:5px;" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #d0d0d0;" colspan="3">
                      <b>Neighbor TruViews:</b>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" >
                      <p>Number of Neighbors</p>
                    </td>
                    <td >
                      <input id="MaxNumNeighbors" width="23px" style="width:23px" class="PropertyValueSpecial" type="text" value="6" onBlur="changeMaxNeighbors()"></input>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" >
                      <p>Show all Neighbors</p>
                    </td>
                    <td >
                      <input id="ShowAllNeighbors" type="checkbox"  onclick="changeMaxNeighbors()"></input>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" >
                      <p>Show Neighbor labels</p>
                    </td>
                    <td >
                      <input id="ShowNeighborLabels" type="checkbox"  checked="true"  onclick="changeNeighborLabelsVisibility()"></input>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" >
                      <div class="iconButton" id="prevTruView"  onclick="OpenPrevScanWorld();">&lt;</div>
                    </td>
                    <td align="" class="Selection">
                      <select id="NeighborSel" width="140px" style="width:140px"   size="1" onchange="truViewChanged()" Onblur="truViewChanged()">                           
                      </select>
                    </td>
                    <td align="center" >
                      <div class="iconButton" id="nextTruView"  onclick="OpenNextScanWorld();">&gt;</div>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" align="center">
                      <input id="jumpBt" title="Navigate to selected TruView" class="PanelButton" value="Load TruView"  type="button" onclick="OnLoadSelectedTruView()"></input>
                    </td>
                  </tr>
                </table>

                <table class="PropertyPanel" style="margin-top:5px;" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color: #d0d0d0;" colspan="3">
                      <b>Display Criteria:</b>
                    </td>
                  </tr>
                  <tr>
                    <td></td>
                    <td class="LabelName">From</td>
                    <td class="LabelName">To</td>
                  </tr>
                  <tr>
                    <td>
                      <input type="checkbox" id="RangeCheck" onclick="chooseRange()">Range</input>
                    </td>
                    <td style="width:110px;">
                      <input id="rangeFrom" class="PropertyValue" Onblur="onRangeFromChange()" type="text"></input>
                    </td>
                    <td style="width:110px;">
                      <input class="PropertyValue" id="rangeTo" Onblur="onRangeToChange()" type="text" >
                      </input>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <input type="checkbox" id="AltitudeCheck" onclick="chooseAltitude()">Altitude</input>
                    </td>
                    <td style="width:110px;">
                      <input class="PropertyValue" id="altitudeFrom" Onblur="onAltFromChange()"  type="text" ></input>
                    </td>
                    <td style="width:110px;">
                      <input class="PropertyValue" id="altitudeTo" Onblur="onAltToChange()"  type="text" ></input>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <input type="checkbox" id="AzimuthCheck" onclick="chooseAzimuth()">Azimuth</input>
                    </td>
                    <td style="width:110px;">
                      <input class="PropertyValue" id="azimuthFrom" Onblur="onAziFromChange()"  type="text" ></input>
                    </td>
                    <td style="width:110px;">
                      <input class="PropertyValue" id="azimuthTo" Onblur="onAziToChange()"  type="text" ></input>
                    </td>
                  </tr>
                  <tr>
                    <td >
                      <input id="UpdateNeighborBt" title="Update neighbors to be displayed" class="PanelButton" value="Update"  type="button" onclick="OnUpdateNeighbor()" style="width:60px;"></input>
                    </td>
                    <td >
                      <input id="ResetNeighborBt" title="Reset ranges for neighbors" class="PanelButton" value="Reset"  type="button" onclick="OnResetNeighbor()" style="width:60px;"></input>
                    </td>
                    <td >
                      <input id="HideNeighborBt" title="Hide all neighbors" class="PanelButton" value="Hide"  type="button" onclick="OnHideNeighbor()" style="width:60px;"></input>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- =========================  -->
              <!-- =    PROGRESS PANEL     =  -->
              <!-- =========================  -->
              <xsl:if test="/cx:Dataset/@ProgressBox = 'true'">
                <div id="progressPanel" class="UIPanel" style="height:60px; margin-top:2px;">
                  <table class="PropertyPanel" style="margin-top:5px;" cellpadding="0" cellspacing="1" border="0">
                    <tr>
                      <td style="background-color: #d0d0d0;">
                        <b>Download Progress:</b>
                      </td>
                    </tr>
                    <tr>
                      <td id="progressCell"></td>
                    </tr>
                  </table>
                </div>
              </xsl:if>
            </td>
            <td style="width:99%" colspan="6" id="objCol">
              <object id="CX_Control"
                height="100%" width="100%"
                classid="CLSID:58F38C51-8DB0-47A5-9E3A-32210E29603A">

                <!--New section-->

                <div align="center">
                  <table width="367" border="2">
                    <!--DWLayoutTable-->
                    <tr>
                      <td  style="background-color: #ffffff;"  width="355"
                           height="178">
                        <blockquote>

                          <p align="left">
                            <br/>
                            <table>
                              <tr>
                                <td style="background-color: #ffffff;" >
                                  <img src="Images/Noplugin.png" />
                                </td>
                                <td style="background-color: #ffffff;">
                                  TruView Plug-In Not Loaded or <br/>
                                  Blocked by IE Security Settings!
                                </td>
                              </tr>
                            </table>                            
                          </p>
                          <p align="left">                            
                            Leica TruView Internet Explorer plug-in required.<br/>
                            If blocked:<br/>
                            1. You can enable TruView one time by clicking the yellow<br/>
                            system message above;<br/>
                            Or<br/>
                            2. You can remove the blocking by setting<br/>
                               Tools-&gt;Internet Options-&gt;Advanced-&gt;Security-&gt; <br/>
                               Allow active content to run in files on my computer.<br/>                            
                            <br/>
                            If TruView plug-in is not installed, Visit <a href ="http://hds.leica-geosystems.com/en/Request-Leica-TruView_63727.htm">
                              Leica Geosystems' website
                            </a> <br/>
                            to acquire this free plug-in
                          </p>
                          <p align="left">
                            <img src="images/lglogo.png" align="right"/>
                          </p>
                        </blockquote>
                      </td>
                    </tr>
                  </table>
                </div>
              </object>
            </td>
          </tr>
        </table>
      </body>

    </html>


  </xsl:template>

</xsl:stylesheet>
