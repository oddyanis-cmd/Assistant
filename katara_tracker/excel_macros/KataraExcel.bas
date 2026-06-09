Attribute VB_Name = "KataraExcel"
'==============================================================================
' Katara Member Tracker - live Excel automation (VBA, standard module)
'
' Works together with the Workbook_SheetChange handler in ThisWorkbook:
'   * Change a row's "Workflow Status" on the Pending/Approved/Paid sheet ->
'     the whole row moves to the matching sheet instantly.
'   * Fill a row on "Create Slide" and set its Workflow Status -> the member is
'     filed into the matching sheet (with an auto App ID if blank) and the form
'     row is cleared.
'   * After either change the "Member Cards" gallery is rebuilt so each member
'     shows as a card with the correct status colour and photo.
'
' Use a MACRO-READY workbook (built with:  extract --macro-ready) so the status
' sheets are plain data tables - that lets rows move cleanly. Photos live on the
' Member Cards sheet, drawn from each row's "Photo file" path.
'
' Desktop Excel (Windows/Mac) only. Save the file as .xlsm and enable macros.
'==============================================================================

Option Explicit

' Card grid geometry - must match the Python card builder.
Private Const CARD_W As Long = 7
Private Const CARD_H As Long = 9
Private Const CARDS_PER_ROW As Long = 3
Private Const GUTTER As Long = 1
Private Const CARD_TOP_ROW As Long = 3

Private Function MaroonColor() As Long
    MaroonColor = RGB(73, 21, 59)      ' 49153B
End Function

Private Function StatusColor(ByVal status As String) As Long
    Select Case status
        Case "Paid": StatusColor = RGB(31, 122, 61)    ' 1F7A3D
        Case "Approved": StatusColor = RGB(0, 176, 80)   ' 00B050
        Case Else: StatusColor = RGB(176, 136, 59)       ' B0883B (Pending)
    End Select
End Function

Private Function IsStatusSheet(ByVal nm As String) As Boolean
    IsStatusSheet = (nm = "Pending approval" Or nm = "Approved" Or nm = "Paid")
End Function

Private Function ValidStatus(ByVal s As String) As Boolean
    ValidStatus = (s = "Pending approval" Or s = "Approved" Or s = "Paid")
End Function

' Column index for a header on a sheet (0 if not found).
Public Function ColIndex(ws As Worksheet, ByVal header As String, _
                         Optional ByVal headerRow As Long = 1) As Long
    Dim c As Long, lastC As Long
    lastC = ws.Cells(headerRow, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastC
        If Trim(CStr(ws.Cells(headerRow, c).Value)) = header Then
            ColIndex = c
            Exit Function
        End If
    Next c
    ColIndex = 0
End Function

'--------------------------------------------------- entry points (from events)

' Move a member row from one status sheet to the sheet named by newStatus.
Public Sub MoveRowToStatus(src As Worksheet, ByVal r As Long, _
                           ByVal newStatus As String)
    Dim dst As Worksheet
    Set dst = ThisWorkbook.Sheets(newStatus)
    Dim lastCol As Long
    lastCol = src.Cells(1, src.Columns.Count).End(xlToLeft).Column
    Dim appCol As Long: appCol = ColIndex(dst, "App ID")
    Dim destRow As Long
    destRow = dst.Cells(dst.Rows.Count, appCol).End(xlUp).Row + 1
    If destRow < 2 Then destRow = 2

    src.Range(src.Cells(r, 1), src.Cells(r, lastCol)).Copy
    dst.Cells(destRow, 1).PasteSpecial Paste:=xlPasteAll
    Application.CutCopyMode = False
    dst.Cells(destRow, ColIndex(dst, "Workflow Status")).Value = newStatus
    src.Rows(r).Delete
End Sub

' File a completed "Create Slide" row into the sheet matching its status.
Public Sub FileNewMember(cs As Worksheet, ByVal r As Long)
    Const HR As Long = 6                ' Create Slide header row
    Dim nameCol As Long: nameCol = ColIndex(cs, "Name", HR)
    If nameCol = 0 Then Exit Sub
    If Trim(CStr(cs.Cells(r, nameCol).Value)) = "" Then Exit Sub

    Dim status As String
    status = Trim(CStr(cs.Cells(r, ColIndex(cs, "Workflow Status", HR)).Value))
    If Not ValidStatus(status) Then status = "Pending approval"

    Dim dst As Worksheet: Set dst = ThisWorkbook.Sheets(status)
    Dim appCol As Long: appCol = ColIndex(dst, "App ID")
    Dim destRow As Long
    destRow = dst.Cells(dst.Rows.Count, appCol).End(xlUp).Row + 1
    If destRow < 2 Then destRow = 2

    Dim c As Long, lastCol As Long, h As String, srcC As Long
    lastCol = dst.Cells(1, dst.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastCol
        h = Trim(CStr(dst.Cells(1, c).Value))
        If h = "Slide #" Then
            dst.Cells(destRow, c).Value = destRow - 1
        ElseIf h <> "" Then
            srcC = ColIndex(cs, h, HR)
            If srcC > 0 Then dst.Cells(destRow, c).Value = cs.Cells(r, srcC).Value
        End If
    Next c
    dst.Cells(destRow, ColIndex(dst, "Workflow Status")).Value = status
    If Trim(CStr(dst.Cells(destRow, appCol).Value)) = "" Then
        dst.Cells(destRow, appCol).Value = "MEM-APP-NEW-" & Format(destRow, "000")
    End If

    ' Clear the input row on the form.
    Dim csLast As Long
    csLast = cs.Cells(HR, cs.Columns.Count).End(xlToLeft).Column
    cs.Range(cs.Cells(r, 1), cs.Cells(r, csLast)).ClearContents
End Sub

' Rebuild the entire Member Cards gallery from the three status sheets.
Public Sub RebuildCards()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Member Cards")
    On Error GoTo 0
    If ws Is Nothing Then Exit Sub

    Application.ScreenUpdating = False

    Dim i As Long
    For i = ws.Shapes.Count To 1 Step -1
        ws.Shapes(i).Delete
    Next i
    ws.Cells.Clear

    With ws.Range("A1")
        .Value = "Member Cards - visual gallery"
        .Font.Bold = True: .Font.Size = 14: .Font.Color = MaroonColor
    End With

    Dim g As Long, base As Long, c As Long
    For g = 0 To CARDS_PER_ROW - 1
        base = 1 + g * (CARD_W + GUTTER)
        For c = base To base + CARD_W - 1
            ws.Columns(c).ColumnWidth = 11
        Next c
        If g < CARDS_PER_ROW - 1 Then ws.Columns(base + CARD_W).ColumnWidth = 2
    Next g

    Dim statuses As Variant: statuses = Array("Pending approval", "Approved", "Paid")
    Dim k As Long: k = 0
    Dim si As Long, src As Worksheet, appCol As Long, lastR As Long, rr As Long
    For si = 0 To 2
        Set src = ThisWorkbook.Sheets(statuses(si))
        appCol = ColIndex(src, "App ID")
        lastR = src.Cells(src.Rows.Count, appCol).End(xlUp).Row
        For rr = 2 To lastR
            If Trim(CStr(src.Cells(rr, appCol).Value)) <> "" _
               Or Trim(CStr(src.Cells(rr, ColIndex(src, "Name")).Value)) <> "" Then
                DrawCard ws, src, rr, k
                k = k + 1
            End If
        Next rr
    Next si

    Application.ScreenUpdating = True
End Sub

'------------------------------------------------------------------- card draw

Private Sub DrawCard(ws As Worksheet, src As Worksheet, ByVal rr As Long, _
                     ByVal k As Long)
    Dim gr As Long, gc As Long, left As Long, top As Long, right As Long
    gr = k \ CARDS_PER_ROW
    gc = k Mod CARDS_PER_ROW
    left = 1 + gc * (CARD_W + GUTTER)
    top = CARD_TOP_ROW + gr * (CARD_H + GUTTER)
    right = left + CARD_W - 1

    Dim status As String, col As Long
    status = CStr(src.Cells(rr, ColIndex(src, "Workflow Status")).Value)
    col = StatusColor(status)

    ' Header band.
    ws.Range(ws.Cells(top, left), ws.Cells(top, left + 4)).Merge
    With ws.Cells(top, left)
        .Value = "MEMBER PROFILE"
        .Interior.Color = MaroonColor
        .Font.Color = vbWhite: .Font.Bold = True: .Font.Size = 10
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
    End With
    ws.Range(ws.Cells(top, left + 5), ws.Cells(top, right)).Merge
    With ws.Cells(top, left + 5)
        .Value = IIf(status = "Pending approval", "Pending", status)
        .Interior.Color = col
        .Font.Color = vbWhite: .Font.Bold = True: .Font.Size = 9
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
    End With
    ws.Rows(top).RowHeight = 20

    ' Portrait from the "Photo file" path.
    Dim photoPath As String
    photoPath = ResolvePhoto(CStr(src.Cells(rr, ColIndex(src, "Photo file")).Value))
    If photoPath <> "" Then
        Dim L As Single, T As Single, pic As Object
        L = ws.Cells(top + 1, left).Left
        T = ws.Cells(top + 1, left).Top
        On Error Resume Next
        Set pic = ws.Shapes.AddPicture(photoPath, msoFalse, msoTrue, L + 2, T + 2, -1, -1)
        If Not pic Is Nothing Then
            pic.LockAspectRatio = msoTrue
            pic.Height = 84
        End If
        On Error GoTo 0
    End If

    ' Info column.
    Dim info As Long: info = left + 2
    SetLine ws, top + 1, info, right, CStr(src.Cells(rr, ColIndex(src, "Name")).Value), True, MaroonColor, 11
    SetLine ws, top + 2, info, right, CStr(src.Cells(rr, ColIndex(src, "App ID")).Value), False, RGB(119, 119, 119), 8
    SetLine ws, top + 3, info, right, CStr(src.Cells(rr, ColIndex(src, "Membership Plan")).Value), False, vbBlack, 9
    SetLine ws, top + 4, info, right, FormatRate(src.Cells(rr, ColIndex(src, "Rate (QAR)")).Value), True, col, 10
    SetLine ws, top + 5, info, right, "CEC: " & CStr(src.Cells(rr, ColIndex(src, "CEC")).Value), False, vbBlack, 9
    SetLine ws, top + 6, info, right, "Mob: " & CStr(src.Cells(rr, ColIndex(src, "Mobile")).Value), False, vbBlack, 9
    SetLine ws, top + 7, info, right, "Applied: " & CStr(src.Cells(rr, ColIndex(src, "Application Date")).Value), False, RGB(85, 85, 85), 8

    ' Card outline.
    With ws.Range(ws.Cells(top, left), ws.Cells(top + CARD_H - 2, right))
        .Borders(xlEdgeLeft).Color = MaroonColor
        .Borders(xlEdgeRight).Color = MaroonColor
        .Borders(xlEdgeTop).Color = MaroonColor
        .Borders(xlEdgeBottom).Color = MaroonColor
    End With

    Dim rh As Long
    For rh = top + 1 To top + 7
        ws.Rows(rh).RowHeight = 16
    Next rh
End Sub

Private Sub SetLine(ws As Worksheet, ByVal r As Long, ByVal c1 As Long, _
                    ByVal c2 As Long, ByVal val As String, ByVal bold As Boolean, _
                    ByVal color As Long, ByVal size As Long)
    ws.Range(ws.Cells(r, c1), ws.Cells(r, c2)).Merge
    With ws.Cells(r, c1)
        .Value = val
        .Font.Bold = bold: .Font.Color = color: .Font.size = size
        .VerticalAlignment = xlCenter
    End With
End Sub

Private Function FormatRate(ByVal v As Variant) As String
    If IsNumeric(v) Then
        FormatRate = Format(v, "#,##0") & " QAR"
    Else
        FormatRate = CStr(v)
    End If
End Function

' Resolve a photo path: absolute, or relative to the workbook folder.
Private Function ResolvePhoto(ByVal p As String) As String
    ResolvePhoto = ""
    If Trim(p) = "" Then Exit Function
    If Dir(p) <> "" Then ResolvePhoto = p: Exit Function
    Dim alt As String
    alt = ThisWorkbook.Path & Application.PathSeparator & p
    If Dir(alt) <> "" Then ResolvePhoto = alt
End Function

' Optional: run manually (Alt+F8) to refresh everything at once.
Public Sub KataraRefreshAll()
    Application.EnableEvents = False
    RebuildCards
    Application.EnableEvents = True
End Sub
