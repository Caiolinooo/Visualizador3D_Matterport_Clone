  
var markupFilename = 'markup.xml';
var version = '1.0';

var tabActiveName = '';
var tabActiveColor = 'whitesmoke';
var tabInactiveColor = 'silver';
var tabHilightColor = '#d0d0d0';
var controlLoading = false;
var currentView = null;
var currentViewIndex = -1;
var changingTab = false;

// 2D Markup selection ...
var selectedMarkupIndex = -1;
var selectedMarkupID = -1;

var selectedMark3DIndex = -1;
var selectedMark3DID = -1;

var loadMarksServerVersion = true;

var repeatCommand = false;

var truViewIndex = -1;
var useRange = false;
var useAltitude = false;
var useAzimuth = false;

// picking data...
var pick = 0;           // number of point picked
var prevX,prevY,prevZ;  // Last 3D coordintes picked
var prev = -1;

//mode
var mode = 2;  
var markupMode = -1;

var markType = 0;

var lockMeasure = false;
//pan zoom parameter
var deltaMode = 0.6;

var curUnit = -1;
var curMeasureColor = '#ffffcc';
var curShapeUnit = -1;

var inAddMarkup = false;
var preLineWidth = '';

var curApiVer = 0;
var leftPaneVisible = true;
var showAllNeighbors = true;

var loadingStarted = false;

var maxNumNeighbors = 6;

function viewOut()
{
	if (mode == 0)
		viewBt.src = "Images/ViewOn.png";
	else
		viewBt.src = "Images/ViewOff.png";
}

function markupOut()
{
	if (mode == 1)  //
		lockBt.src = "Images/MarkupOn.png";
	else
		lockBt.src = "Images/MarkupOff.png";
}

function rotateOut()
{
	if (mode == 2)
		rotBt.src = "Images/RotateOn.png";
	else
		rotBt.src = "Images/RotateOff.png";
}

function zoomHover()
{
	if (mode == 2)
		zoomBt.src = "Images/ZoomHover.png";
	else
		zoomBt.src = "Images/ZoomDisable.png";
}

function positionOut()
{
	if( !lockMeasure ) 
	{
		if(markType==1) 
			PositionBt.src='Images/xyzOn.png'; 
		else 
			PositionBt.src='Images/xyzOff.png';
	}  
	else   
		PositionBt.src = 'Images/xyzDisable.png';      
}

function positionOver()
{
	if ( !lockMeasure ) 
		PositionBt.src='Images/xyzHover.png';
	else 
		PositionBt.src = 'Images/xyzDisable.png';
	
}

function pointOut()
{
	if(markupMode==4) 
		PointBt.src='Images/CoordOn.png'; 
	else 
		PointBt.src='Images/CoordOff.png';
}

function distOut()
{
	if( !lockMeasure ) 
	{
		if(markType==2) 
			DistanceBt.src='Images/RulerOn.png'; 
		else 
			DistanceBt.src='Images/RulerOff.png';
	}     
	else     
		DistanceBt.src = 'Images/RulerDisabled.png'; 
}

function distOver()
{
	if (!lockMeasure) 
		DistanceBt.src = 'Images/RulerHover.png';
	else 
		DistanceBt.src = 'Images/RulerDisabled.png';
	
}

function hotLinkOver()
{
    if (!lockMeasure) 
        HotlinkBt.src = 'Images/HotlinkHover.png';
    else
        HotlinkBt.src = 'Images/HotlinkDisabled.png';            
}

function hotLinkOut()
{
	if( !lockMeasure ) 
	{
        if (markType == 3)
            HotlinkBt.src = 'Images/HotlinkOn.png';
        else
            HotlinkBt.src = 'Images/HotlinkOff.png';
    }
    else
        HotlinkBt.src = 'Images/HotlinkDisabled.png';
}

function showHideScanWorldsOut()
{
	if (mode == 0)
		hideScanWorldsBt.src = "Images/TriangOn.png";
	else
		hideScanWorldsBt.src = "Images/TriangOff.png";

}


function lenOut()
{
	if(markupMode==5) 
		LengthBt.src='Images/DimOn.png'; 
	else 
		LengthBt.src='Images/DimOff.png';
}

function measureImgsOn()
{   
	zoomBt.src = "Images/ZoomOff.png";
	panBt.src = "Images/PanOff.png";
}

function measureImgsDisable()
{   
	zoomBt.src = "Images/ZoomDisable.png";
	panBt.src = "Images/PanDisable.png";
	PositionBt.src = "Images/xyzOff.png";
	DistanceBt.src='Images/RulerOff.png'; 
}

function updateModeImg( )
{
	switch(mode)
	{
	case 0:
		viewBt.src = "Images/ViewOff.png";
		break;
	case 1:
		updateMarkupImg(-1);
		lockBt.src = "Images/MarkupOff.png";
		stop2DAdd();
		break;
	case 2:        
		measureImgsDisable();
		CX_Control.Mark3DClear();
		while ( Mark3DList.options.length>0 )
		{ Mark3DList.options.remove(0); }
		selectedMark3DIndex = -1;
		selectedMark3DID = -1;
		updateMark3DProperty();
		rotBt.src = "Images/RotateOff.png";
		break;
	}
}

function updateToolbar( newMode )
{
	if (mode == newMode)
		return; 
	
	if ( mode== 2 && markType > 0)
	  stopMeasure(newMode);
	
	updateModeImg();    
	  
	mode = newMode;

	switch(mode)
	{
	case 0:  // view      
	  CX_Control.SetAlphaMode( 0 );
	  lockMeasure = false;
	  viewBt.src = "Images/ViewOn.png";
	  if (curApiVer >= 1)
	  {
	  	  CX_Control.SetEnableDrawNeighbor(0);
	  	  neighborPanel.className = 'UIPanelInvisible';
	  }
	  break;
	case 1: 
	  lockBt.src = "Images/MarkupOn.png";
	  lockMeasure = true;
      if(curApiVer >= 1)
      { 
         if (curUnit != -1)
             CX_Control.ShapeSetCurrentUnit(curUnit);
         CX_Control.SetEnableDrawNeighbor(0);
         neighborPanel.className = 'UIPanelInvisible';
      }
	  break;
	case 2:  //pan/zoom
	  lockMeasure = false;
	  CX_Control.SetAlphaMode( 0 );

	  measureImgsOn();   
	  rotBt.src = "Images/RotateOn.png";
	  if(curApiVer >= 1)
      { 
	    if (curUnit != -1)
	       select3DUnit(curUnit);
        CX_Control.SetEnableDrawNeighbor(-1);
        neighborPanel.className = 'UIPanel';
      }
	  break;
	}
	
	if (lockMeasure)
	{
		PositionBt.src = "Images/xyzDisable.png";
		DistanceBt.src = "Images/RulerDisabled.png";
	}
	else
	{
		PositionBt.src = "Images/xyzOff.png";
		DistanceBt.src = "Images/RulerOff.png";
	}
	updateNavBtns();
}
function viewClick()
{
	if(mode == 0)
		return;
	
	activateTab('Views', true);
}

// _________________________________________________________________________________________
//
function stopMove( obj )
{
	repeatCommand = false;
	tt_ShowDiv(true);
	if (obj == zoomBt)
	{
		zoomBt.src = "Images/ZoomOff.png";
	}
	else if (obj == panBt)
	{
		panBt.src = "Images/PanOff.png";
	}
}

function mouseDblClick( mouseEvent, x, y )
{
if (mouseEvent != 9)
		return;
		
	if ( mode == 2)
	{
		updateMarkupImg(-1);
		return;  
	}
	activateTab('Measure', true);
	CX_Control.ViewUnlock( -1 );
}

function resetView()
{
  CX_Control.SetZoom( 80.0 );
  CX_Control.SetAltitude( 0.0 );
  CX_Control.SetAzimuth( 0.0 );
  CX_Control.Redraw();
}

function panZoomClick(obj)
{
	x = window.event.offsetX;
	y = window.event.offsetY;
	tt_ShowDiv(false);
	repeatCommand= true;
	
	updateToolbar( 2 );
   
	deactivateSelectedView();
	CX_Control.ViewUnlock( -1 );

	deltaMode = 0.4;
	updatePanZoomDelta();
	
	if (obj == zoomBt)
	{
		if (y < obj.offsetHeight/2)
		{
			zoomBt.src = "Images/ZoomIn.png";
			zoomIn();
		}
		else
		{
			zoomBt.src = "Images/ZoomOut.png";
			zoomOut();
		}
	}
	else if (obj == panBt)
	{        
		tempx = obj.offsetWidth / 3;
		tempy = obj.offsetHeight / 3;
		if (x < tempx)
		{
			if (y < tempy)
			{
				panBt.src = "Images/PanUpLeft.png";
				moveUpLeft();
			}
			else if (y > 2 * tempy)
			{
				panBt.src = "Images/PanDownLeft.png";
				moveDownLeft();
			}
			else
			{
				panBt.src = "Images/PanLeft.png";
				moveLeft();
			}
		}
		else if (x > 2 * tempx)
		{
			if (y < tempy)
			{
				panBt.src = "Images/PanUpRight.png";
				moveUpRight();
			}
			else if (y > 2 * tempy)
			{
				panBt.src = "Images/PanDownRight.png";
				moveDownRight();
			}
			else
			{
				panBt.src = "Images/PanRight.png";
				moveRight();
			}
		}
		else
		{
			if(y < tempy || (x > 12 && x < 20 && y < 16))
			{
				panBt.src = "Images/PanUp.png";
				moveUp();
			}
			else if (y > 2 * tempy ||
				(x > 12 && x < 20 && y > 16))
			{
				panBt.src = "Images/PanDown.png";
				moveDown();
			}
			else if ( y > 12 && y < 20)
			{
			   if (x > 16)
			   {
					panBt.src = "Images/PanRight.png";
					moveRight();
			   }
			   else
			   {
					panBt.src = "Images/PanLeft.png";
					moveLeft();
			   }
			}
		}
	}
}

function updatePanZoomDelta ( )
{
	 deltaMode += 0.4;
	 if ( repeatCommand )
		setTimeout("updatePanZoomDelta()",60 );     
}

// _________________________________________________________________________________________
//
function deactivateSelectedView()
{
	  ViewList.selectedIndex = -1;
	  currentView = null;
	  currentViewIndex = -1;
	  updateViewProperty();
	  ViewPropPanel.disabled = true;
}

// _________________________________________________________________________________________
//
function stopMove()
{
	repeatCommand = false;
}

// _________________________________________________________________________________________
//
function moveUp(  )
{
	CX_Control.SetAltitude( CX_Control.GetAltitude()+ deltaMode );
	if ( repeatCommand )
		setTimeout("moveUp()",10 );
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function moveDown(  )
{
	CX_Control.SetAltitude( CX_Control.GetAltitude()- deltaMode );
	CX_Control.Redraw();
	if ( repeatCommand )
		setTimeout("moveDown()",10 );
}

// _________________________________________________________________________________________
//
function moveLeft(  )
{
	CX_Control.SetAzimuth( CX_Control.GetAzimuth()- deltaMode );
	if ( repeatCommand )
		setTimeout("moveLeft()",10 );
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function moveRight(  )
{
	CX_Control.SetAzimuth( CX_Control.GetAzimuth()+ deltaMode );
	if ( repeatCommand )
		setTimeout("moveRight()",10 );
	CX_Control.Redraw();
}

function moveUpLeft( )
{    
   CX_Control.SetAltitudeAzimuth(deltaMode, - deltaMode);
		
	if ( repeatCommand )
		setTimeout("moveUpLeft()",20 );
	CX_Control.Redraw();
}

function moveDownLeft()
{
	CX_Control.SetAltitudeAzimuth(-deltaMode, -deltaMode);
	if ( repeatCommand )
		setTimeout("moveDownLeft()",20 );
	CX_Control.Redraw();
}

function moveUpRight()
{
   CX_Control.SetAltitudeAzimuth(deltaMode, deltaMode);
	if ( repeatCommand )
		setTimeout("moveUpRight()",20 );
	CX_Control.Redraw();
}

function moveDownRight()
{
	CX_Control.SetAltitudeAzimuth(-deltaMode, deltaMode);
	
	if ( repeatCommand )
		setTimeout("moveDownRight()",20 );
	CX_Control.Redraw();
}


// _________________________________________________________________________________________
//
function zoomIn( )
{
	CX_Control.SetZoom( CX_Control.GetZoom()- deltaMode );
	if ( repeatCommand )
		setTimeout("zoomIn()",1 );
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function zoomOut( )
{
	CX_Control.SetZoom( CX_Control.GetZoom()+ deltaMode );
	if ( repeatCommand )
		setTimeout("zoomOut()",1 );
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function changeFillColorShape()
{
   if ( currentView == null )
	{
		var sourceColor = shapeFillColorTxt.style.backgroundColor;
		var destColor = "#ffffff";
		destColor = CX_Control.ChooseHTMLColor( sourceColor );
		shapeFillColorTxt.style.backgroundColor = destColor;
		return;
	}
	var sourceColor = currentView.ShapeGetFillColor( selectedMarkupID );
	var destColor = "#ffffff";
	destColor = CX_Control.ChooseHTMLColor( sourceColor );
	if ( destColor.length > 0 )
	{
		currentView.ShapeSetFillColor( selectedMarkupID, destColor );
		shapeFillColorTxt.style.backgroundColor = destColor;
	}
}

// _________________________________________________________________________________________
//
function shapeUnitChanged()
{
	if ( currentView == null)
		return;
	   
	var selIndex = shapeUnitSel.options.selectedIndex;
	var value = shapeUnitSel.options[selIndex].value ;

    if (curApiVer < 1)
        curShapeUnit = value;
    else
    	curUnit = value;
	currentView.ShapeSetUnit( selectedMarkupID, value );
	
	var i;
	for (i = MarkupList.length - 1; i>=0; i--) 
	{
	  if (MarkupList.options[i].selected) 
	  {
		MarkupList.remove(i);
	  }
	}
	
	MarkupList.selectedIndex = i + 1;
	if (selectedMarkupID == -1)
	   return;
	var oOption = document.createElement("OPTION");

	oOption.text = currentView.ShapeGetTypeName( selectedMarkupID );;
	oOption.value= selectedMarkupID;
	MarkupList.add(oOption, MarkupList.selectedIndex);
	MarkupList.selectedIndex = i + 1;
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function changeColorShape()
{
	if ( currentView == null )
	{
		var sourceColor = shapeColorTxt.style.backgroundColor;
		var destColor = "#ffffff";
		destColor = CX_Control.ChooseHTMLColor( sourceColor );
		shapeColorTxt.style.backgroundColor = destColor;
		return;
	}
	var sourceColor = currentView.ShapeGetColor( selectedMarkupID );
	var destColor = "#ffffff";
	destColor = CX_Control.ChooseHTMLColor( sourceColor );
	if ( destColor.length > 0 )
	{
		currentView.ShapeSetColor( selectedMarkupID, destColor );
		shapeColorTxt.style.backgroundColor = destColor;
	}
}

function changeFontSizeShape()
{
	if ( currentView == null)
		return;

	currentView.ShapeSetFontSize( selectedMarkupID, Number(shapeFontSizeTxt.value) )
	CX_Control.Redraw();
}

function changeAlphaShape()
{
	if ( currentView == null)
		return;
	if (shapeAlphaTxt.value < 0)
		shapeAlphaTxt.value = 0;
	else if (shapeAlphaTxt.value > 100)
		shapeAlphaTxt.value = 100;
		
	currentView.ShapeSetAlpha( selectedMarkupID, Number(shapeAlphaTxt.value) )
	CX_Control.Redraw();
}

function changeLineThincknessShape()
{
	if ( currentView == null)
		return;

	if (markupMode == 3)
	{      
	  currentView.ShapeSetText(selectedMarkupID, textContent.value);
	  return;
	}
	currentView.ShapeSetLineWidth( selectedMarkupID, Number(shapeLineWidthTxt.value) );
	CX_Control.Redraw();
}

function textChanged()
{
  var type = currentView.ShapeGetType(selectedMarkupID);
  if ((inAddMarkup && markupMode == 3) || type == 2)
  {
	if (currentView != null)    
	{
	  if (textContent.value != "")
		 currentView.ShapeSetText(selectedMarkupID, textContent.value);
	  }
  }
 
}

function changeLinkShape()
{
	if ( selectedMarkupID<0 || currentView == null)
		return;
	
	currentView.ShapeSetHREF( selectedMarkupID, shapeLinkTxt.value );
	CX_Control.Redraw();
}

// _________________________________________________________________________________________
//
function showProgress( progressValue )
{
   progressCell.innerHTML = "<table border='0' cellspan='0' cellpadding='0' style='width:100%'>"
					 + "<tr><td colspan='2' align='left' style='font-size:8pt;'>Download "+ progressValue+"% Complete</td></tr>"
					 + "<tr><td class='ProgressBar' style='width:"+progressValue+"%;'></td><td/></tr></table>";
  if (loadingStarted && progressValue > 0)
  {
    loadingStarted = false;
    updateToolBar();
  }
  			 
  if (progressValue == 100)
  {
    progressPanel.className = 'UIPanelInvisible';
    var unit = CX_Control.DefaultUnit;
    select3DUnit(unit);
    if (MaxNumNeighbors.value == 0)
    {
        MaxNumNeighbors.value = CX_Control.MaxNumNeighborsToDisplay;
        ShowNeighborLabels.checked = CX_Control.ShowNeighborLabels;
    }
    changeMaxNeighbors();
  }

}

function updateMeasureImg( newMode)
{
	if (newMode == markType)
		return;
	switch(markType)
	{
	case 1:
		PositionBt.src = "Images/xyzOff.png";
		break;
	case 2:
		DistanceBt.src="Images/RulerOff.png";
		break;
    case 3:
        HotlinkBt.src="Images/HotlinkOff.png";
        break;
	}

	markType = newMode;
	if (markType == 0)
	    neighborPanel.className = 'UIPanel';
	else
	    neighborPanel.className = 'UIPanelInvisible';
	
	updateNavBtns();
}

// _________________________________________________________________________________________
//
function pickDistance()
{
  if (markType == 2)
  {
	 stopMeasure(0);
	 return;
  }
	
  if (markType == 3)
  {
    stopMeasure(0);
  }  
	
  if ((markType == 0) || (markType == 3))
  {
	activateTab( 'Measure', true );    
	CX_Control.SetMode( 1 );    // Mode 1 : Picking opoint
	CX_Control.SetAlphaMode( -1 );
  }
  updateMeasureImg(2);
  DistanceBt.src="Images/RulerOn.png";  
}


// _________________________________________________________________________________________
//
function pickVertex()
{
	if (markType == 1)
	{
	  stopMeasure(0);
	  return;
	}
	  
	if (markType == 2)
	{
	  if (pick == 1)
	  {
		if (prev > 0)
		  CX_Control.Mark3DRemove( prev );
		pick = 0;
	  }
	}
	else
	{
	  if (markType == 3)
	  {
	    stopMeasure(0);
	  }  
	  activateTab( 'Measure', true );    
	  CX_Control.SetMode( 1 );    // Mode 1 : Picking opoint
	  CX_Control.SetAlphaMode( -1 );
	}
	updateMeasureImg(1);  // coord
	PositionBt.src = "Images/xyzOn.png";    
}

// _________________________________________________________________________________________
//
function placeHotLink()
{
	if (markType == 3)
	{
	  stopMeasure(0);
	  return;
	}
	  
	if (markType == 2)
	{
	  if (pick == 1)
	  {
		if (prev > 0)
		  CX_Control.Mark3DRemove( prev );
		pick = 0;
	  }
	}

    if (markType != 0)
    {
	    stopMeasure(0);
    }  
	activateTab( 'Measure', true );    
	CX_Control.SetMode( 4 );    // Mode 1 : Picking opoint
	
	updateMeasureImg(3);  // coord
	HotlinkBt.src = "Images/HotlinkOn.png";    
}



// _________________________________________________________________________________________
//
function loadMarkup()
{
   // MarkupFileNameInput.click();
   // var filename = MarkupFileNameInput.value;
	
	var filename = "";
	filename = CX_Control.ChooseFileName("Choose Markup File to Open", "XML\0*.xml\0All\0*.*\0", false);
	if ( filename == "" )
		return;
	 if ( CX_Control.LoadMarks( filename, true  ) )
	{
	 //   alert('Markup file '+ filename +' was loaded successfully');
	   if ( filename.length>30 )
			MarkupFileNameText.innerHTML = '...'+filename.substr(filename.length-30, filename.length);
		else
			MarkupFileNameText.innerHTML = filename;
	    if(mode == 0)
	    {
	        viewSelection(); 
	    }
	}
}

// _________________________________________________________________________________________
//
function saveMarkup()
{
	var filename = "";
	filename = CX_Control.ChooseFileName("Save Markup File", "XML\0*.xml\0All\0*.*\0", true);
	if ( filename.length == 0 )
		return;
		
 //   markupFilename = filename;
	if ( CX_Control.SaveMarks( filename ) )
	{
	//    alert('Markup file '+ filename +' was saved successfully');
		if ( filename.length>30 )
			MarkupFileNameText.innerHTML = '...'+filename.substr(filename.length-30, filename.length);
		else
			MarkupFileNameText.innerHTML = filename;
	}
 }

// ____________________________________________________________________________
//
function addView( viewName, viewID )
{
	var oOption = document.createElement("OPTION");
	oOption.text = viewName;
	oOption.value= viewID;
	ViewList.add(oOption);   
	ViewList.selectedIndex = ViewList.options.length - 1;
}

// ____________________________________________________________________________
//
function rotClick()
{
	activateTab('Measure', true);
}

// ____________________________________________________________________________
//
function unlockView()
{
	CX_Control.ViewUnlock( -1 );
}

// ____________________________________________________________________________
//
function lockView()
{
	updateToolbar( 1 );

	// 1 - Check if the control is already in a locked view
	var lockedView  = CX_Control.ViewGetCurrent();

	// 2 - Create and lock a new view
	if ( lockedView==null )
	{
		if ( currentView==null )
		{
			currentView = CX_Control.ViewCapture();  // Create the view
			currentView.CreatedOn = getDate();
			currentView.UserName = CX_Control.RetrieveUserName();
			CX_Control.Views.Add( currentView );     // Add it to the control view collection
		}
		currentView.Apply(true);                // Activate it locked
		if (!inAddMarkup)
		{
		  updateMarkupUI();
		  activateTab("Markup",false);
		}
	}
	else
	{
		currentView = lockedView;
		currentView.Apply(true);
	}
	
}


// ____________________________________________________________________________
//
function viewLockChanged( flag )
{
	if ( flag )
	{
		updateToolbar( 1 );

		if ( tabActiveName=='Markup' )
			return;
		if ( !changingTab )
			activateTab( 'Markup',false );
		//alert('Tab Changed! Current tab='+tabActiveName);
	}
	else
	{
		if (mode == 2 && tabActiveName == 'Measure')
			return;
		//alert('View is being unlocked! Current tab='+tabActiveName);
		if ( tabActiveName=='Views' && mode == 0 )
			return;
		if ( !changingTab )
		{
			if (mode == 0)
				activateTab( 'Views',false );
			else
				activateTab( 'Measure',false );
		}
	}
	
}

function updateMarkupImg( newMode )
{    
	if (markupMode == newMode)
		return;
	
	//change from Line, Rect, Circle or text to Dist, Point
	if (markupMode <= 3 && newMode > 3) 
	{      
	  CX_Control.ViewUnlock( 0 ); 
	  CX_Control.SetAlphaMode( -1 );
	}
	else if (markupMode > 3 && newMode <= 3)   
	{
	  CX_Control.ViewUnlock( 0 );
	  CX_Control.SetAlphaMode( 0 );
	}
	else if (markupMode == -1 && newMode <= 3)
	{
	  CX_Control.SetAlphaMode( 0 );
	}
	
	
	if(markupMode == 3)
	  shapeLineWidthTxt.value = preLineWidth;
	else if (newMode == 3)
	{      
	  preLineWidth = shapeLineWidthTxt.value
	  textContent.value = '';
	}

	if (newMode != -1)
	{
		lockMeasure = true;
		PositionBt.src = "Images/xyzDisable.png";
		DistanceBt.src = "Images/RulerDisabled.png";
		HotlinkBt.src = "Images/HotlinkDisabled.png";
	}
	else
	{
		lockMeasure = false;
		PositionBt.src = "Images/xyzOff.png";
		DistanceBt.src = "Images/RulerOff.png";
		HotlinkBt.src = "Images/HotlinkOff.png";
	}
	switch(markupMode)
	{
	case 0:
		LineBt.src = "Images/LineOff.png";
		break;
	case 1:
		CircBt.src = "Images/CircOff.png";
		break;
	case 2:
		RectBt.src = "Images/RectOff.png";
		break;
	case 3:
		TextBt.src = "Images/TextOff.png";
		break;
	case 4:
		PointBt.src = 'Images/CoordOff.png';
		break;
	case 5:
		LengthBt.src = 'Images/DimOff.png';
		break;
	}
	markupMode = newMode;
	
	switch(markupMode)
	{
	case 0:
		LineBt.src = "Images/LineOn.png";
		break;
	case 1:
		CircBt.src = "Images/CircOn.png";
		break;
	case 2:
		RectBt.src = "Images/RectOn.png";
		break;
	case 3:
		TextBt.src = "Images/TextOn.png";
		break;
	case 4:        
		PointBt.src = 'Images/CoordOn.png';
		break;
	case 5:
		LengthBt.src = 'Images/DimOn.png';
		break;
	}  
}

function selectShapeUnit(unit)
{
    if (unit == 0)
    {
         shapeUnitSel.options.selectedIndex = 0;
         return;
    }

    if (unit == 1)
    {
         shapeUnitSel.options.selectedIndex = 1;
         return;
    }

    if (unit == 10)
    {
         shapeUnitSel.options.selectedIndex = 2;
         return;
    }

    if (unit == 20)
    {
         shapeUnitSel.options.selectedIndex = 3;
         return;
    }
    
    if (unit == 30)
    {
         shapeUnitSel.options.selectedIndex = 4;
         return;
    }

    if (unit == 40)
    {
         shapeUnitSel.options.selectedIndex = 5;
         return;
    }
	
    if (unit == 50)
    {
         shapeUnitSel.options.selectedIndex = 6;
         return;
    }
}
// _________________________________________________________________________________________
//
function populateDefaultShapeProperties( shapeType )
{
	if ( shapeType == -1 && selectedMarkupID>=0 && currentView != null)        
		currentView.ShapeSelect(-1, false);
	
	MarkupPropPanel.disabled = false;
	MarkupList.selectedIndex = -1;    
	selectedMarkupIndex = -1;
	selectedMarkupID = -1;
	shapeCreatedTxt.innerHTML = "";
	shapeUserTxt.innerHTML = "";
	shapeLinkTxt.value = "";
	
        
	if (inAddMarkup && shapeType > 0)
	{
	  var color = currentView.ShapeGetColor( -1 );
	  var alpha = currentView.ShapeGetAlpha( -1 );
	  var fillColor = currentView.ShapeGetFillColor( -1 );
	  var lineWidth = currentView.ShapeGetLineWidth( -1 );
	  var fontSize = currentView.ShapeGetFontSize( -1 );

      if (curApiVer < 1)
        var unit = currentView.ShapeGetUnit( -1 );  
      else
      {
	      if (curUnit == -1)
	      {
	          var unit = currentView.ShapeGetUnit( -1 );  
	          curUnit = unit;
	      }  
	  }  	    	
	
	  if (shapeType <= 12)
		fontSize = -1;
	}
	else
	{
	  if (curApiVer < 1)
	  {
	    if (shapeType == 14 || shapeType == 15 || shapeType == -1)
        {
	        var unit = CX_Control.ShapeGetDefaultUnit( shapeType );
	        selectShapeUnit(unit);
	    }
	    else
	        shapeUnitSel.options.selectedIndex = -1;
	  }
	  else if (curUnit == -1)
	  { 
	    var unit = CX_Control.ShapeGetDefaultUnit( shapeType );
	    curUnit = unit;
	  }
	  var color = CX_Control.ShapeGetDefaultColor(  );    
	  shapeColorTxt.style.backgroundColor = color;
	  shapeAlphaTxt.value = CX_Control.ShapeGetDefaultAlpha(  );
	  var fillColor = CX_Control.ShapeGetDefaultFillColor(  );
	  shapeFillColorTxt.style.backgroundColor = fillColor;
	  preLineWidth = CX_Control.ShapeGetDefaultLineWidth( );
	  if (shapeType != 13)
	  {
		shapeLineWidthTxt.value = preLineWidth;
	  }
		  
	  var fontSize = CX_Control.ShapeGetDefaultFontSize( shapeType );
	}

    if (curApiVer >= 1)
    {
        if (shapeType == 14 || shapeType == 15)
	    {
	        selectShapeUnit(curUnit);
	        shapeUnitSel.disabled = false;
	    }
	    else
        {
            shapeUnitSel.disabled = true;
            shapeUnitSel.options.selectedIndex = -1;
        }
    }

	if (fontSize == -1)
	{
		shapeFontSizeTxt.value = "N/A";
		shapeFontSizeTxt.disabled = true;
		shapeFontSize.disabled = true;
	}
	else
	{
		shapeFontSizeTxt.value = fontSize;
		shapeFontSizeTxt.disabled = false;
		shapeFontSize.disabled = false;
	}
	
}

function stop2DAdd()
{
  if (currentView != null)
	currentView.StopShapeAdd();
  inAddMarkup = false;
  updateMarkupImg(-1);
  lockView();
}

function stop2DEdit()
{   
  if (inAddMarkup)
  {
	var shapeName = "";
	switch (markupMode)
	{
	case 0:
		shapeName = "Line";
		break;
	case 1:
		shapeName = "Circle";
		break;
	case 2:
		shapeName = "Rectangle";
		break;
	case 4:
		shapeName = "Position2D";
		break;
	case 5:
		shapeName = "Distance2D";
		break;
	}
	if ( markupMode == 3 )
	{        
		currentView.AddShapeText("");
		shapeLineWidthTxt.value = "";
	}
	else			
		currentView.addShape(shapeName);
  }
}
// _________________________________________________________________________________________
//
function addShape( shapeName )
{
	// Lock the view to 2D mode (it creates a new view if needed)
	lockMeasure = true;
	
	var temp = -1;
	switch( shapeName )
	{
		case 'Rectangle':
			updateMarkupImg(2);
			temp = 12;
			break;
		case 'Circle':
			updateMarkupImg(1);
			temp = 11;
			break;
		case 'Line':
			updateMarkupImg(0);
			temp = 10;
			break;
		case 'Position2D':
			updateMarkupImg(4);
			temp = 14;
			break;
		case 'Distance2D':
			updateMarkupImg(5);
			temp = 15;
			break;
	}
	
	lineOrText.innerHTML = "Line Thickness:";
	textContent.className = "PropertyValueHidden";
	shapeLineWidthTxt.className = "PropertyValueSpecial";
	if (!inAddMarkup)
	  inAddMarkup = true;
	lockView();
	
	// 2 - Add a rectangle to the current view (stay in locked mode)
	currentView.addShape( shapeName);
	populateDefaultShapeProperties(temp);
}

// _________________________________________________________________________________________
//
function addText()
{
  lockMeasure = true;
  lineOrText.innerHTML = "Text:";
  textContent.className = "PropertyValue";
  shapeLineWidthTxt.className = "PropertyValueHidden";
  updateMarkupImg(3);
  TextBt.src = "Images/TextOn.png";
  
  populateDefaultShapeProperties(13);
  
  if (!inAddMarkup)
	inAddMarkup = true;

  // Lock the view to 2D mode (it creates a new view if needed)
  lockView();
  
  // 3 - Add a rectangle to the current view (stay in locked mode)
  currentView.AddShapeText("");   
}

// ____________________________________________________________________________
//
function viewDClick()
{
   //alert( "currentViewIndex = "+currentViewIndex);
   activateTab("Markup",true);
}

// ____________________________________________________________________________
//
function currentShapeDelete()
{
	if ( selectedMarkupID<0 || currentView == null)
		return;
		
	currentView.ShapeDelete( selectedMarkupID, true );
}

// ____________________________________________________________________________
//
function setCurrentShapeAsDefault()
{
	if (currentView == null || selectedMarkupID < 0)
	{
	   CX_Control.ShapeSetDefaultColor(shapeColorTxt.style.backgroundColor );
	   CX_Control.ShapeSetDefaultFillColor( shapeFillColorTxt.style.backgroundColor );
	   CX_Control.ShapeSetDefaultLineWidth( Number(shapeLineWidthTxt.value) );
	   CX_Control.ShapeSetDefaultAlpha( Number(shapeAlphaTxt.value) );
	   CX_Control.ShapeSetDefaultFontSize( Number(shapeFontSizeTxt.value) ); 
	   
	   var selIndex = shapeUnitSel.options.selectedIndex;
	   var value = shapeUnitSel.options[selIndex].value ;  
	   CX_Control.ShapeSetDefaultUnit(value);
	}
	else
		currentView.ShapeSetPropertiesAsDefault( selectedMarkupID );
}

function updateMarkupList()
{
    var i;
	for (i = MarkupList.length - 1; i>=0; i--) 
	{
	  if (MarkupList.options[i].selected) 
	  {
		MarkupList.remove(i);
	  }
	}
	
	MarkupList.selectedIndex = i + 1;
	if (selectedMarkupID == -1)
	   return;
	var oOption = document.createElement("OPTION");

	oOption.text = currentView.ShapeGetTypeName( selectedMarkupID );;
	oOption.value= selectedMarkupID;
	MarkupList.add(oOption, MarkupList.selectedIndex);
	MarkupList.selectedIndex = i + 1;
}
// ____________________________________________________________________________
//
function resetCurrentShape()
{
	if ( selectedMarkupID<0 || currentView == null)
		return;

   currentView.ShapeResetProperties( selectedMarkupID );
   updateMarkupList();
   CX_Control.Redraw();
   updateShapeProperty();
 /*  currentView.ShapeSetColor( selectedMarkupID, shapeColorTxt.style.backgroundColor );
   currentView.ShapeSetFillColor( selectedMarkupID, shapeFillColorTxt.style.backgroundColor );
   currentView.ShapeSetLineWidth( selectedMarkupID, Number(shapeLineWidthTxt.value) );
   currentView.ShapeSetAlpha( selectedMarkupID, Number(shapeAlphaTxt.value) );
   currentView.ShapeSetFontSize( selectedMarkupID, Number(shapeFontSizeTxt.value) )
   currentView.ShapeSetHREF( selectedMarkupID, shapeLinkTxt.value );*/

   //     shapeAlphaTxt.value = "";
   //     shapeLineWidthTxt.value = "";
   //     shapeCreatedTxt.value = "";
   //     shapeUserTxt.value = "";
   //     shapeFontSizeTxt.value = "";
}

function updateText()
{
  var text = currentView.ShapeGetText(selectedMarkupID);
  textContent.value = text;
}

// ____________________________________________________________________________
//
function updateShapeProperty()
{
	if ( selectedMarkupID>0 )
	{
		var color = currentView.ShapeGetColor( selectedMarkupID );
		var alpha = currentView.ShapeGetAlpha( selectedMarkupID );
		var fillColor = currentView.ShapeGetFillColor( selectedMarkupID );
		var fontSize = currentView.ShapeGetFontSize( selectedMarkupID );
		var hrefTxt = currentView.ShapeGetHREF( selectedMarkupID );
		var userName = currentView.ShapeGetUserName( selectedMarkupID );
		var createdOn = currentView.ShapeGetTime( selectedMarkupID );
		var unit = currentView.ShapeGetUnit( selectedMarkupID );
		
		var type = currentView.ShapeGetType(selectedMarkupID);
		if (type == 2)  // text
		{
		  lineOrText.innerHTML = "Text:";
		  textContent.className = "PropertyValue";
		  shapeLineWidthTxt.className = "PropertyValueHidden";
		  var text = currentView.ShapeGetText(selectedMarkupID);		  
		  textContent.value = text;
		}
		else
		{
		  lineOrText.innerHTML = "Line Thickness:";
		  textContent.className = "PropertyValueHidden";
		  shapeLineWidthTxt.className = "PropertyValueSpecial";
		  var lineWidth = currentView.ShapeGetLineWidth( selectedMarkupID );
		  shapeLineWidthTxt.value = lineWidth;
		}
		
		if (type > 2)
		    shapeUnitSel.disabled = false;
		else
		    shapeUnitSel.disabled = true;
		  shapeAlphaTxt.value = alpha;
		shapeCreatedTxt.innerHTML = createdOn;
		shapeUserTxt.innerHTML = userName;
		if (fontSize == -1)
		{
			shapeFontSizeTxt.value = "N/A";
			shapeFontSizeTxt.disabled = true;
			shapeFontSize.disabled = true;
		}
		else
		{
			shapeFontSizeTxt.value = fontSize;
			shapeFontSizeTxt.disabled = false;
			shapeFontSize.disabled = false;
		}

		selectShapeUnit(unit);
		shapeLinkTxt.value = hrefTxt;
		
		shapeFillColorTxt.style.backgroundColor = fillColor;
		shapeColorTxt.style.backgroundColor = color;
	}
	else if (!inAddMarkup)
	{
		shapeColorTxt.innerHTML = "";
		shapeFillColorTxt.innerHTML = "";
		shapeAlphaTxt.value = "";
		shapeLineWidthTxt.value = "";
		textContent.value="";
		shapeCreatedTxt.innerHTML = "";
		shapeUserTxt.innerHTML = "";
		shapeFontSizeTxt.value = "";
		shapeLinkTxt.value = "";
		shapeUnitSel.options.selectedIndex = -1;
	}
		
}

function getDate()
{
	var currentTime = new Date();
	var month = currentTime.getMonth() + 1;
	var day = currentTime.getDate();
	var year = currentTime.getFullYear();
	var todayTxt = month + "/" + day + "/" + year;
	return todayTxt;
}
// ____________________________________________________________________________
//
function updateViewProperty()
{
	if ( currentView!=null )
	{
		ViewNameInput.value = currentView.Name;
		ViewNameTitle.innerHTML = currentView.Name;
		ViewCreatedTxt.value = currentView.CreatedOn;        
		ViewUserTxt.value = currentView.UserName;
	}
	else
	{
		ViewNameInput.value = "";
		ViewNameTitle.innerHTML = "";
		ViewCreatedTxt.value = "";
		ViewUserTxt.value = "";
	}
}

function clearMarkup( from )
{
  var result = CX_Control.ClearViews(from);
  if (result)
  {
	var viewIndex = 0;    
	while ( ViewList.options.length>0 )
	{ ViewList.options.remove(0); }
	while (MarkupList.options.length>0)
	{
	  MarkupList.options.remove(0);
	}
	updateToolbar(0); 
	activateTab("Views", false);
	CX_Control.ViewUnlock(-1);  
	deactivateSelectedView();
	CX_Control.Redraw();   
  } 
}

// ____________________________________________________________________________
//
function loadPresavedMarkup( whichversion )
{
   if ( whichversion )
	  clearMarkup(1);
   else
	  clearMarkup(2);
   CX_Control.LoadMarks(markupFilename, whichversion ); // Do Force server version of markup to load if whichversion == true
   if ( whichversion )
		MarkupFileNameText.innerHTML = "Server side marks: " + markupFilename;
   else
		MarkupFileNameText.innerHTML = "Client side marks: " + markupFilename;    
   viewSelection();      
}

// ____________________________________________________________________________
//
function ViewDelete()
{
	if ( currentView==null )
		return;
		
	CX_Control.ViewUnlock( -1 );
	CX_Control.Views.Remove( currentViewIndex );

	var viewIndex = 0;    
	for ( viewIndex=0; viewIndex < ViewList.options.length; viewIndex++)
	{
		if ( ViewList.options[viewIndex].value == currentView.ID )
		{
			ViewList.options.remove(viewIndex);
			currentView = null;
			currentViewIndex = -1;
			break;
		}
	}

}


////////////////////////////////////////////////////////////////////////////////
//  BEGIN           3D Mark Functions
////////////////////////////////////////////////////////////////////////////////
// ____________________________________________________________________________
//
function deleteMark3D( id )
{
	var markIndex = 0;    
	for ( markIndex=0; markIndex < Mark3DList.options.length; markIndex++)
	{
		if ( Mark3DList.options[markIndex].value == id )
		{
			Mark3DList.options.remove(markIndex);
		}
	}
}


// _________________________________________________________________________________________
//
function changeMark3DColor()
{
	if ( selectedMark3DID==-1)
		return;
  
	var sourceColor = CX_Control.Mark3DGetColor( selectedMark3DID );
	var destColor = "#ffffff";
	destColor = CX_Control.ChooseHTMLColor( sourceColor );
	curMeasureColor = destColor;
	CX_Control.Mark3DSetColor( selectedMark3DID, destColor );
	updateMark3DProperty();
}

// _________________________________________________________________________________________
//
function mark3DUnitChanged()
{
	if ( selectedMark3DID==-1)
		return;
	var selIndex = Mark3DUnitSel.options.selectedIndex;
	var value = Mark3DUnitSel.options[selIndex].value ;

	curUnit = value;
	CX_Control.Mark3DSetUnit(selectedMark3DID, value);
	CX_Control.Redraw();
	updateMark3DProperty();
}


// ____________________________________________________________________________
//
function newMark3D( id )
{
	Mark3DPropPanel.disabled = false;
	var name = CX_Control.Mark3DGetTypeName(id);
	name = name + ": " + CX_Control.Mark3DGetName(id);

	var oOption = document.createElement("OPTION");
	oOption.text = name;
	oOption.value= id;
	Mark3DList.add(oOption);
	
	for ( selectedMark3DIndex=0; selectedMark3DIndex<Mark3DList.options.length;selectedMark3DIndex++)
	{
		if ( Mark3DList.options[selectedMark3DIndex].value == id )
		{
			break;
		}
	}
	
	Mark3DList.options.selectedIndex = selectedMark3DIndex ;
	selectedMark3DID = id;
	updateMark3DProperty();  
}

// ____________________________________________________________________________
//
function mark3DSelection()
{
	var index = Mark3DList.selectedIndex;
	var val = Mark3DList.options[index].value;
	
	if ( val<=0 )
	{
		selectedMark3DIndex = -1;
		selectedMark3DID = -1;
		Mark3DPropPanel.disabled = true;
		return;
	}

	selectedMark3DIndex = index;
	selectedMark3DID = val;
	Mark3DPropPanel.disabled = false;
  
	CX_Control.Mark3DSelectChanged(selectedMark3DID);
	updateMark3DProperty()
}

// _________________________________________________________________________________________
//
function mark3DDClick()
{
	if ( selectedMark3DID==-1)
		return;
	deactivateSelectedView();
	CX_Control.FocusOnMark3D( selectedMark3DID );

	CX_Control.Redraw();
}

function getUnitFromID(id)
{
    switch (id)
    {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
            return 10;
        case 3:
            return 20;
    }
}

function select3DUnit(unit)
{
    if (unit == 0)
    {
        Mark3DUnitSel.options.selectedIndex = 0;
        return;
    }
    
     if (unit == 1)
    {
        Mark3DUnitSel.options.selectedIndex = 1;
        return;
    }
    
    if (unit == 10)
    {
        Mark3DUnitSel.options.selectedIndex = 2;
        return;
    }
    
     if (unit == 20)
    {
        Mark3DUnitSel.options.selectedIndex = 3;
        return;
    }
    
    if (unit == 30)
    {
        Mark3DUnitSel.options.selectedIndex = 4;
        return;
    }
    
    if (unit == 40)
    {
        Mark3DUnitSel.options.selectedIndex = 5;
        return;
    }
    
    if (unit == 50)
    {
        Mark3DUnitSel.options.selectedIndex = 6;
        return;
    }
}
// uses selectedMark3DID to fill the properties of the selected Mark3D object
// ____________________________________________________________________________
//
function updateMark3DProperty()
{
	if (selectedMark3DID == -1)
	{
	  Mark3DTypeTxt.innerHTML = "";
	  Mark3DXTxt.innerHTML = "";
	  Mark3DYTxt.innerHTML = "";
	  Mark3DZTxt.innerHTML = "";
	  Mark3DDistTxt.innerHTML = "";
	  Mark3DColorCell.innerHTML = "";
	  return;
	}
	Mark3DTypeTxt.innerHTML = CX_Control.Mark3DGetTypeName(selectedMark3DID);
	if (Mark3DTypeTxt.innerHTML == "Distance")
	{
		Mark3DXNameTxt.innerHTML = "&#916;X:";
		Mark3DYNameTxt.innerHTML = "&#916;Y:";
		Mark3DZNameTxt.innerHTML = "&#916;Z:";
	}
	else
	{
		Mark3DXNameTxt.innerHTML = "X:";
		Mark3DYNameTxt.innerHTML = "Y:";
		Mark3DZNameTxt.innerHTML = "Z:";
	}
	
	Mark3DXTxt.innerHTML = round2Dec( CX_Control.Mark3DGetXCoord(selectedMark3DID) );
	Mark3DYTxt.innerHTML = round2Dec( CX_Control.Mark3DGetYCoord(selectedMark3DID) );
	Mark3DZTxt.innerHTML = round2Dec( CX_Control.Mark3DGetZCoord(selectedMark3DID) );
	Mark3DDistTxt.innerHTML = round2Dec ( CX_Control.Mark3DGetValue(selectedMark3DID) );
	Mark3DColorCell.style.backgroundColor = CX_Control.Mark3DGetColor(selectedMark3DID);
	
	var unit = CX_Control.Mark3DGetUnit(selectedMark3DID);
	select3DUnit(unit);	
}


// ____________________________________________________________________________
//
function Mark3DHide( )
{
	CX_Control.Mark3DHide( );
	CX_Control.Redraw();
}


////////////////////////////////////////////////////////////////////////////////
//  END           3D Mark Functions
////////////////////////////////////////////////////////////////////////////////



// ____________________________________________________________________________
//
function ViewRename( newName )
{
	if ( currentView==null )
		return;
	
	currentView.Name = newName;

	var viewIndex = 0;    
	for ( viewIndex=0; viewIndex < ViewList.options.length; viewIndex++)
	{
		if ( ViewList.options[viewIndex].value == currentView.ID )
			ViewList.options[viewIndex].text = newName;
	}

	   
}

// ____________________________________________________________________________
//
function viewSelection()
{
	ViewNameInput.value = "";

	currentViewIndex = ViewList.selectedIndex;
	if (currentViewIndex == -1)
	    return;
	var val = ViewList.options[currentViewIndex].value;
	var view = CX_Control.Views.find( val );

	currentView = view;

	if ( currentView!=null )
	{
		updateToolbar( 0 );
		currentView.Apply(false);
		CX_Control.Redraw();
		ViewPropPanel.disabled = false;
	}

	updateViewProperty();

}

// ____________________________________________________________________________
//
function shapeSelection()
{
	var index = MarkupList.selectedIndex;    
	var val = MarkupList.options[index].value;
	if (inAddMarkup)
	  CX_Control.StopShapeAdd();

	MarkupList.selectedIndex = index;
	if ( val<=0 )
	{
		selectedMarkupIndex = -1;
		selectedMarkupID = -1;
		MarkupPropPanel.disabled = true;
		return;
	}

	if ( !currentView.ShapeSelect( val, false ) )
	{
		selectedMarkupIndex = -1;
		selectedMarkupID = -1;
		MarkupPropPanel.disabled = true;
		return;
	}
	
	MarkupPropPanel.disabled = false;
	selectedMarkupIndex = index;
	selectedMarkupID = val;
	
	updateShapeProperty()    
}

// ____________________________________________________________________________
//
function selection2D( drwID )
{  
	if ( !inAddMarkup && drwID<=0 )
	{
		MarkupPropPanel.disabled = true;
		MarkupList.selectedIndex = -1;
		selectedMarkupID = -1;
		updateShapeProperty();		
		return;
	}
	
	MarkupPropPanel.disabled = false;
	if (tabActiveName != "Markup")
	{
	  activateTab("Markup", true);
	}
	
	if (drwID > 0)
	{
	  for ( selectedMarkupIndex=0; selectedMarkupIndex<MarkupList.options.length;selectedMarkupIndex++)
	  {
		  if ( MarkupList.options[selectedMarkupIndex].value == drwID )
		  {
			  break;
		  }
	  }
	  
	  MarkupList.selectedIndex = selectedMarkupIndex;
	  selectedMarkupID = drwID;
	  updateShapeProperty();
	}
}

// ____________________________________________________________________________
//
function shapeRemoved( drwID )
{
	if ( currentView == null )
		return;
		
	selectedMarkupIndex = -1;
	selectedMarkupID = -1;
	updateMarkupUI();
}

// ____________________________________________________________________________
//
function newShape( drwID )
{
	if ( currentView == null )
		return;
	currentView.ShapeSetUserName ( drwID,  CX_Control.RetrieveUserName() );
	
	currentView.ShapeSetTime ( drwID, getDate() );

	var oOption = document.createElement("OPTION");
	oOption.text = currentView.ShapeGetTypeName( drwID );
	oOption.value= drwID;
	MarkupList.add(oOption);
}

// ____________________________________________________________________________
//
function updateMarkupUI()
{
// to do: need to make it work: disable the properties with correct selection
  if (!inAddMarkup)    
	MarkupPropPanel.disabled = true;
	
	while (MarkupList.options.length > 0 )
		MarkupList.options.remove(0);

  shapeLineWidthTxt.disabled = false;
  textContent.disabled = false;
	if ( currentView == null )
		return;
		
	ViewNameTitle.innerHTML = currentView.Name;
	var itemID = currentView.GetFirstShape();
	while( itemID!=-1 )
	{
		var oOption = document.createElement("OPTION");
		oOption.text = currentView.ShapeGetTypeName( itemID );;
		oOption.value= itemID;
		MarkupList.add(oOption);
	
		itemID = currentView.GetNextShape();
	}
}

// ____________________________________________________________________________
//
function activateTab( tabname, updateLock )
{
	if ( tabActiveName==tabname || changingTab==true )
		return;

	changingTab = true;

	tabActiveName = tabname;
	
	updateNavBtns();
	switch( tabname )       
	{
	case 'Markup':
		MarkupTab.className = 'tabActive';
		ViewsTab.className = 'tab';
		MeasureTab.className = 'tab';
		MarkupPanel.className  = 'UIPanelVisible';
		ViewsPanel.className   = 'UIPanelInvisible';
		MeasurePanel.className = 'UIPanelInvisible';
		
		if ( updateLock )
		{
		  if ( currentView!=null )
			currentView.Apply(true);
		   if (markupMode == -1)
		    addShape('Line');
		}
		updateMarkupUI();
		updateToolbar ( 1 ); 
		if (!inAddMarkup && selectedMarkupID == -1)
		  populateDefaultShapeProperties ( -1 );
		if (curApiVer >= 1)
		   selectShapeUnit(curUnit);

		break;
	case 'Views':
		MarkupTab.className = 'tab';
		ViewsTab.className = 'tabActive';
		MeasureTab.className = 'tab';
		MarkupPanel.className  = 'UIPanelInvisible';
		ViewsPanel.className   = 'UIPanelVisible';
		MeasurePanel.className = 'UIPanelInvisible';
		if ( updateLock )
		{
			CX_Control.ViewUnlock( -1 );
			if (ViewList.options.length == 0)  // not current view
			{
				currentView = CX_Control.ViewCapture();  // Create the view
				currentView.CreatedOn = getDate();
				currentView.UserName = CX_Control.RetrieveUserName();
				CX_Control.Views.Add( currentView );     // Add it to the control view collection
				currentView.Apply(false);     
				updateViewProperty();
				ViewPropPanel.disabled = false;          
			}
			else
			{
				if (ViewList.selectedIndex == -1)
					ViewList.selectedIndex = 0;
				viewSelection();                    
			}
		   // alert ("current view is " + ViewList.selectedIndex);
			updateToolbar ( 0 );
		}
		break;
	case 'Measure':
		MarkupTab.className = 'tab';
		ViewsTab.className = 'tab';
		MeasureTab.className = 'tabActive';
		MarkupPanel.className  = 'UIPanelInvisible';
		ViewsPanel.className   = 'UIPanelInvisible';
		MeasurePanel.className = 'UIPanelVisible';
		if (curApiVer < 1)
		    Mark3DPropPanel.disabled = false;
		else
		{
		    if (CX_Control.MeasureEnabled)
			    Mark3DPropPanel.disabled = false;
		    else
		        Mark3DPropPanel.disabled = true;
		}
		if ( updateLock )
		{
			updateToolbar(2);

			CX_Control.ViewUnlock( -1 );
		}
		// Deselect and disable property
   //     Mark3DPropPanel.disabled = true;
		break;
	}
  
	changingTab = false;
  
}


// _________________________________________________________________________________________
//
function round2Dec( floatnumber )
{
	return Math.round(floatnumber*1000.0)/1000.0;
}

// _________________________________________________________________________________________
//
function managePicking( x,y,z )
{
	if ( x==0.0 && y==0.0 && z==0.0 )
	{
		return;
	}
   
	switch( markType )
	{
	case 1: // Vertex Picking No Label
		pick = 0;
		CX_Control.VertexMark3D(x,y,z,curUnit, curMeasureColor);
		break;
	case 2: // Distance Picking
		pick++;
		if ( pick == 1 )
		{
			prev = CX_Control.VertexMark3D(x,y,z,curUnit, curMeasureColor);
			prevX = x;
			prevY = y;
			prevZ = z;
			Mark3DTypeTxt.innerHTML = "First Vertex";
		}
		else if ( pick == 2 )
		{
			if ( prev > 0 )
				CX_Control.Mark3DRemove( prev );
			prev = CX_Control.DistanceMark3D(prevX,prevY,prevZ, x,y,z,curUnit, curMeasureColor );
			
			pick = 0;
		}
		break;
     case 3:
		pick = 0;
		CX_Control.HotlinkMark3D(x,y,z,curUnit, curMeasureColor);
        break;  // HotLink Placement		
	}
}

function stopMeasure( newMode )
{
  if (markType == 2)
  {
	if (pick == 1)
	{
	  if (prev > 0)
		CX_Control.Mark3DRemove( prev );
	  pick = 0;
	}
  }
  CX_Control.SetMode(0);
  if (!(newMode == 1 && markupMode > 3))
	CX_Control.SetAlphaMode( 0 );
	 
  updateMeasureImg ( 0 );
}

// ____________________________________________________________________________
//
function prevView()
{
	var newIndex = currentViewIndex-1;
	if (newIndex<0 ) 
		newIndex = ViewList.options.length-1;
	if ( newIndex>=ViewList.options.length )
		newIndex = 0;
		
	ViewList.selectedIndex = newIndex;
	currentViewIndex = newIndex;
	
	var val = ViewList.options[currentViewIndex].value;
	currentView = CX_Control.Views.find( val );

	CX_Control.ViewUnlock( -1 );
	currentView.Apply(true);
	updateMarkupUI();
}

// ____________________________________________________________________________
//
function nextView()
{
	var newIndex = currentViewIndex+1;
	if (newIndex<0 ) 
		newIndex = ViewList.options.length-1;
	if ( newIndex>=ViewList.options.length )
		newIndex = 0;
		
	ViewList.selectedIndex = newIndex;
	currentViewIndex = newIndex;
	
	var val = ViewList.options[currentViewIndex].value;
	currentView = CX_Control.Views.find( val );

	//alert("IDX="+newIndex+"  Name="+currentView.Name);

	CX_Control.ViewUnlock( -1 );
	currentView.Apply(true);
	updateMarkupUI();
}

function print()
{
  if (mode != 2)
	CX_Control.Print( -1 );
  else
	CX_Control.Print( 0 );
}
function menuEvent( m )
{
	switch(m)
	{
	case 0:
		viewClick();
		break;
	case 1:
		addShape('Line');
		break;
	case 2:
		rotClick();
		break;
		
	case 10:
		addShape( 'Line' );
		break;
	case 11:
		addShape( 'Circle' );
		break;
	case 12:
		addShape( 'Rectangle' );
		break;
	case 13:
		addText( );
		break;
	case 14:
		addShape( 'Position2D' );
		break;
	case 15:
		addShape( 'Distance2D' );
		break;
	case 20:
		print();
		break;
	}
}

function shape2DDelete( shapeid )
{
	if (currentView == null)
		return;
		
	currentView.ShapeDelete( shapeid, true );
}


function setCurrentMeasureAsDefault()
{
  if (selectedMark3DID == -1)
  {
    CX_Control.DefaultUnit = getUnitFromID(Mark3DUnitSel.options.selectedIndex);
  	return;
  }

  CX_Control.Mark3DSetAsDefault( selectedMark3DID );
}

function KeyHandle(e)
{
	var key = window.event ? e.keyCode : e.which;
	if (key == 46)
	{
		currentShapeDelete();
	}
}

function ViewKeyHandle(e)
{
	var key = window.event ? e.keyCode : e.which;
	if (key == 46)
	{
		ViewDelete();
	}
}

function showTruViewHelp()
{
  CX_Control.ShowHelp(); 
}

function showTruViewAbout()
{
  CX_Control.ShowAbout();
}

function showInfo()
{
	var src = CX_Control.src;
	window.open(src,'mywindow','width=500,height=600, status=yes, scrollbars=yes,resizable=yes');
}

function updateToolBar()
{
    if (curApiVer < 1)
    {
        neighborPanel.className = 'UIPanelInvisible';
        SiteMapBt.className='iconToolbarButtonHide';
        return;
    }
	SiteMapBt.className='iconToolbarButton';
	if (!CX_Control.MeasureEnabled)
	{
		PositionBt.className  = 'iconToolbarButtonHide';
		DistanceBt.className  = 'iconToolbarButtonHide';
		measurementToolbar.className  = 'toolbarHide';
		measurementToolbarTitle.className='toolbarTitleHide';
		Mark3DPropPanel.disabled = true;
		
		PointBt.className  = 'iconToolbarButtonHide';
		LengthBt.className  = 'iconToolbarButtonHide';
		
	}
	
	if (CX_Control.HasNeighborTruViews)
	{
		neighborPanel.className = 'UIPanel';
		updateNeighborRanges();
	    updateNeighborsList();
	}
}

function updateNeighborRanges()
{
    RangeCheck.checked = CX_Control.IsRangeUsed(0);
    AltitudeCheck.checked = CX_Control.IsRangeUsed(1);
    AzimuthCheck.checked = CX_Control.IsRangeUsed(2);

	rangeFrom.value = round2Dec(CX_Control.GetNeighborDistRange(-1));
	rangeTo.value = round2Dec(CX_Control.GetNeighborDistRange(0));
	
	altitudeFrom.value = round2Dec(CX_Control.GetNeighborAltitudeRange(-1));
	altitudeTo.value = round2Dec(CX_Control.GetNeighborAltitudeRange( 0 ));
	
	azimuthFrom.value = round2Dec(CX_Control.GetNeighborAzimuthRange(-1));
	azimuthTo.value = round2Dec(CX_Control.GetNeighborAzimuthRange(0));
	    
    chooseRange();
	chooseAzimuth();
	chooseAltitude();
	updateNavBtns();
//    updateNeighborsList();
//    CX_Control.MaxNumNeighborsToDisplay = maxNumNeighbors;
//    updateNeighborsListWithMax(maxNumNeighbors);
	CX_Control.Redraw();
}

function updateNeighborsList()
{
    // Update the neighbor list with one or more of the range filters if these are used
    if ((CX_Control.IsRangeUsed(0)) || (CX_Control.IsRangeUsed(1)) || (CX_Control.IsRangeUsed(2)))
    {
	    while (NeighborSel.options.length > 0 )
		    NeighborSel.options.remove(0);

        var numNeighbors = CX_Control.GetNeighborTruViewCount();
        CX_Control.MaxNumNeighborsToDisplay = numNeighbors;
    	   
	    var i;
	    for (i = 0; i < numNeighbors; i++) 
	    {
		    var name = CX_Control.GetNextNeighborTruViewByAlpha(i);
		    if (name != "")
		    {
		        if (CX_Control.IsNeighborVisible(name))
		        {
			        var oOption = document.createElement("OPTION");
			        oOption.text = name;
			        oOption.value= i;
			        NeighborSel.add(oOption);
			    }
		    }
	    }
       
	    NeighborSel.options.selectedIndex = truViewIndex;
	}
}

function updateNeighborsListWithMax(maxNeighbors)
{
	while (NeighborSel.options.length > 0 )
		NeighborSel.options.remove(0);
		
    var count = CX_Control.GetNeighborTruViewCount();
	var i;
	for (i = 0; i < count; i++) 
	{
		var name = CX_Control.GetNextNeighborTruViewByAlpha(i);
		if (i < maxNeighbors)
		{
		    if (name != "")
		    {
			    var oOption = document.createElement("OPTION");
			    oOption.text = name;
			    oOption.value= i;
			    NeighborSel.add(oOption);
			    CX_Control.SetNeighborVisibility(name, true);
		    }
		}
		else
		{
		    name = CX_Control.GetNextNeighborTruViewByDistance(i);
		    CX_Control.SetNeighborVisibility(name, false);
		}
	}
   
	NeighborSel.options.selectedIndex = truViewIndex;
}

function openNewTruView( truViewName )
{
	window.navigate(truViewName);
}

function updateNavBtns()
{
	if (mode != 2 || (mode == 2 && markType != 0))
	{
		prevTruView.className = 'iconButtonDisable';
		nextTruView.className = 'iconButtonDisable';
		NeighborSel.disabled = true;
	}
	else
	{
		if (truViewIndex < 0)
		{
			prevTruView.className = 'iconButtonDisable';
			jumpBt.disabled = true;
		}
		else
		{
			prevTruView.className = 'iconButton';
			jumpBt.disabled = false;
		}	
			
		if (truViewIndex < NeighborSel.options.length -1)
			nextTruView.className = 'iconButton';
		else
			nextTruView.className = 'iconButtonDisable';
		NeighborSel.disabled = false;
	}   
}
function OpenPrevScanWorld()
{
	if (mode != 2 || truViewIndex == -1)
		return;
	
	if (truViewIndex > 0)
		truViewIndex--;
		  
	NeighborSel.options.selectedIndex = truViewIndex;
	truViewChanged();
}

function OpenNextScanWorld()
{
	if (mode != 2)
		return;
	if (truViewIndex >= NeighborSel.options.length -1 )
		return;
	truViewIndex++;
	NeighborSel.options.selectedIndex = truViewIndex;
	truViewChanged();
}

function OpenSiteMap()
{
    if (curApiVer < 1)
        return;
	var sitemap = CX_Control.SiteMap;
	if (sitemap != "")
	   window.open(sitemap);
}

function truViewChanged()
{
	truViewIndex = NeighborSel.options.selectedIndex;
	if (truViewIndex < 0)
		return;
	var value = NeighborSel.options[truViewIndex].value;
	CX_Control.FocusOnTruView(value);
	updateNavBtns();
	CX_Control.Redraw();
}

function chooseRange()
{
	useRange = RangeCheck.checked;
	rangeFrom.disabled = !useRange;
	rangeTo.disabled = !useRange;    
    OnUpdateNeighbor();
}

function chooseAltitude()
{
	useAltitude = AltitudeCheck.checked;

	altitudeFrom.disabled = !useAltitude;
	altitudeTo.disabled = !useAltitude;
    OnUpdateNeighbor();
}
function chooseAzimuth()
{
	useAzimuth = AzimuthCheck.checked;
	azimuthFrom.disabled = !useAzimuth;
	azimuthTo.disabled = !useAzimuth;    
    OnUpdateNeighbor();
}

function OnUpdateNeighbor()
{    
	CX_Control.SetDistNeighborRange(RangeCheck.checked, Number(rangeFrom.value), Number(rangeTo.value));   
	CX_Control.SetNeighborAltitudeRange(AltitudeCheck.checked, Number(altitudeFrom.value), Number(altitudeTo.value));
	CX_Control.SetNeighborAzimuthRange(AzimuthCheck.checked, Number(azimuthFrom.value), Number(azimuthTo.value));
	CX_Control.Redraw();
	if ((RangeCheck.checked)||(AltitudeCheck.checked)||(AzimuthCheck.checked))
	    closestNeighborsPanelDisabled(true);
}

function OnResetNeighbor()
{
	CX_Control.ResetNeighborRanges();
	CX_Control.MaxNumNeighborsToDisplay = maxNumNeighbors;
	updateNeighborsListWithMax(maxNumNeighbors);
	CX_Control.Redraw();
	closestNeighborsPanelDisabled(false);
}

function onRangeFromChange()
{
    if(rangeFrom.value=="")
       rangeFrom.value = round2Dec(CX_Control.GetNeighborDistRange(-1));
    OnUpdateNeighbor();
}

function onRangeToChange()
{
    if(rangeTo.value=="")
       rangeTo.value = round2Dec(CX_Control.GetNeighborDistRange(0));
    OnUpdateNeighbor();
}

function onAltFromChange()
{
    if(altitudeFrom.value=="")
       altitudeFrom.value = round2Dec(CX_Control.GetNeighborAltitudeRange(-1));
    OnUpdateNeighbor();
}

function onAltToChange()
{
    if(altitudeTo.value=="")
       altitudeTo.value = round2Dec(CX_Control.GetNeighborAltitudeRange(0));
    OnUpdateNeighbor();
}

function onAziFromChange()
{
    if(azimuthFrom.value=="")
       azimuthFrom.value = round2Dec(CX_Control.GetNeighborAzimuthRange(-1));
    OnUpdateNeighbor();
}

function onAziToChange()
{
    if(azimuthTo.value=="")
       azimuthTo.value = round2Dec(CX_Control.GetNeighborAzimuthRange(0));
    OnUpdateNeighbor();
}

function newApiAdded( index )
{
    curApiVer = index;
    updateToolBar();
}

function hideShowLeft()
{
if(leftPaneVisible) {
    leftPaneVisible = false;
    leftPanel.className="hiddenTd";
    panelPanel.className  = 'UIPanelInvisible';
    MarkupPanel.className  = 'UIPanelInvisible';
    ViewsPanel.className   = 'UIPanelInvisible';
    MeasurePanel.className = 'UIPanelInvisible';
    SaveLoadMarkupPanel.className = 'UIPanelInvisible';
    neighborPanel.className = 'UIPanelInvisible';
    progressPanel.className = 'UIPanelInvisible';
    HideShowBt.src= "Images/ShowOff.png";
    leftTitle.className= 'hiddenTd';
    tempTitle.className= 'visibleTd';
}
else {
    leftPaneVisible = true;
    leftPanel.className='visibleTd';
    if (mode == 0)
        ViewsPanel.className = "UIPanelVisible";
    else if (mode == 1)
        MarkupPanel.className = "UIPanelVisible";
    else
        MeasurePanel.className = "UIPanelVisible";
    SaveLoadMarkupPanel.className = 'UIPanelVisible';
	neighborPanel.className = 'UIPanelVisible';
	progressPanel.className = 'UIPanelVisible';
	panelPanel.className = 'UIPanel';
    HideShowBt.src="Images/HideOff.png";
    leftTitle.className= 'visibleTd';
	tempTitle.className= 'hiddenTd';
  }
}

function scroll()
{
    if (curApiVer == 0)
        return;
    if (mode == 1)
        currentView.OnContainerScroll();
}

function OnLoadSelectedTruView()
{
    truViewIndex = NeighborSel.options.selectedIndex;
 	  if (truViewIndex < 0)
		  return;
	var value = NeighborSel.options[truViewIndex].value;
	CX_Control.LoadSelectedTruView(value);
}

function neighborPanelDisabled( flag)
{
    UpdateNeighborBt.disabled = flag;
    prevTruView.disabled = flag;
    nextTruView.disabled = flag;
    NeighborSel.disabled = flag;
    MaxNumNeighbors.disabled = flag;
    RangeCheck.disabled = flag;
    rangeFrom.disabled = flag;
    rangeTo.disabled = flag;
    AltitudeCheck.disabled = flag;
    altitudeFrom.disabled = flag;
    altitudeTo.disabled = flag;
    AzimuthCheck.disabled = flag;
    azimuthFrom.disabled = flag;
    azimuthTo.disabled = flag;
    ResetNeighborBt.disabled = flag;
    ShowAllNeighbors.disabled = flag;
    ShowNeighborLabels.disabled = flag;
}

function closestNeighborsPanelDisabled (flag)
{
    prevTruView.disabled = flag;
    nextTruView.disabled = flag;
//    NeighborSel.disabled = flag;
    MaxNumNeighbors.disabled = flag;
    ShowAllNeighbors.disabled = flag;
}

function OnHideNeighbor()
{
    if (!controlLoading)
        return;
    if (showAllNeighbors)
    {
        showAllNeighbors = false;
        HideNeighborBt.value = "Show";
        jumpBt.disabled = true;
        neighborPanelDisabled(true);
        CX_Control.HideAllNeighbors();
        CX_Control.Redraw();
    }
    else
    {
        showAllNeighbors = true;
        HideNeighborBt.value = "Hide";
        neighborPanelDisabled(false);
        updateNavBtns();
        OnUpdateNeighbor();
    }
}

function changeMaxNeighbors()
{
    if (isNaN(MaxNumNeighbors.value))
        return;
    
    maxNumNeighbors = MaxNumNeighbors.value;
    if (ShowAllNeighbors.checked)
    {
        MaxNumNeighbors.value = CX_Control.GetNeighborTruViewCount();
        maxNumNeighbors = CX_Control.GetNeighborTruViewCount();
    }    
        
    if  (maxNumNeighbors != "")  
        CX_Control.MaxNumNeighborsToDisplay = maxNumNeighbors;
    
    updateNeighborsListWithMax(maxNumNeighbors);
    CX_Control.Redraw();
    setMaxNeighborsCookie();
}

function setMaxNeighborsCookie()
{
    var neighborsCookieString = "MaxNumNeighbors" + "=" + maxNumNeighbors + ";" + "path=" + "/";
    document.cookie = neighborsCookieString;
}

function setShowLabelsCookie()
{
    var showLabelsCookieString;
    if (ShowNeighborLabels.checked == true)
        showLabelsCookieString = "showLabels" + "=" + 1 + ";" + "path=" + "/";
    else
        showLabelsCookieString = "showLabels" + "=" + 0 + ";" + "path=" + "/";            
     document.cookie = showLabelsCookieString;

}

function setMaxNeighborsFromCookie()
{
    var neighborsCookie = get_cookie("MaxNumNeighbors");
    if (neighborsCookie != null)
    {
        MaxNumNeighbors.value = neighborsCookie;
    }
    else
    {
        // From published value
        MaxNumNeighbors.value = CX_Control.MaxNumNeighborsToDisplay;
    }
    changeMaxNeighbors();
    var showLablesCookie = get_cookie("showLabels");
    if (neighborsCookie != null)
    {
        if (1 == showLablesCookie)
            ShowNeighborLabels.checked = true;
        else
            ShowNeighborLabels.checked = false;
    }
    else
    {
        //From Published value
        ShowNeighborLabels.checked = CX_Control.ShowNeighborLabels;
    }
    changeNeighborLabelsVisibility();
}

function get_cookie ( cookie_name )
{
  var cookie = document.cookie;
  var results = document.cookie.match ( '(^|;) ?' + cookie_name + '=([^;]*)(;|$)' );

  if ( results )
    return ( unescape ( results[2] ) );
  else
    return null;
}

function changeNeighborLabelsVisibility()
{
    CX_Control.ShowNeighborLabels = ShowNeighborLabels.checked;
    setShowLabelsCookie();
    CX_Control.Redraw();
}

function browseForFile()
{
    shapeLinkTxt.value = CX_Control.GetFileNameFromFileDialog();
    CX_Control.Redraw();
    changeLinkShape();
}

function Pointer()
{
    document.body.style.cursor = "hand";
}

function DefaultCursor()
{
    document.body.style.cursor = "default";
}
