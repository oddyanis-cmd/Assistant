Attribute VB_Name = "KataraAutoSort"
'==============================================================================
' Katara Member Tracker - PowerPoint automation (VBA)
'
' Re-sorts the deck into Pending -> Approved -> Paid sections automatically,
' based on each slide's status note, with NO manual slide dragging. Also keeps
' the section divider slides in place and refreshes their "N member(s)" counts.
'
' HOW STATUS IS READ (no extra data entry needed):
'   * a slide is PAID      if it has a shape whose text is "Paid"
'   * a slide is APPROVED  if it has a shape whose text is "Approved"
'   * otherwise it is PENDING (no green note)
'   These are the same green notes already on your slides.
'
' INSTALL (once):
'   1. Save the deck as .pptm  (File > Save As > PowerPoint Macro-Enabled).
'   2. Alt+F11 (VBA editor) > File > Import File... > pick this .bas.
'   3. Back in PowerPoint, run it any of these ways:
'        - Alt+F8 > ReorganizeByStatus > Run, or
'        - add a button: Insert > Shapes, then Insert > Action >
'          "Run macro: ReorganizeByStatus" (one click re-sorts everything), or
'        - turn on live mode: run StartAutoSort (re-sorts every few seconds).
'
' Desktop PowerPoint (Windows/Mac) only - not web/online or LibreOffice.
'==============================================================================

Option Explicit

' Re-sort interval for live mode (seconds).
Private Const AUTOSORT_INTERVAL As Long = 5
Private mAutoSortOn As Boolean

'------------------------------------------------------------------ public API

' Main entry point: re-sort all slides into status sections + refresh counts.
Public Sub ReorganizeByStatus()
    Dim pres As Presentation
    Set pres = ActivePresentation

    ' Stable bubble sort by sort-key using Slide.MoveTo. Equal keys keep their
    ' existing relative order, so members stay in their current sequence.
    Dim swapped As Boolean, i As Long
    Do
        swapped = False
        For i = 1 To pres.Slides.Count - 1
            If SortKey(pres.Slides(i)) > SortKey(pres.Slides(i + 1)) Then
                pres.Slides(i + 1).MoveTo i
                swapped = True
            End If
        Next i
    Loop While swapped

    RefreshDividerCounts pres
End Sub

' Live mode: re-sort automatically on a timer until StopAutoSort is called.
Public Sub StartAutoSort()
    mAutoSortOn = True
    ReorganizeByStatus
    ScheduleNextSort
End Sub

Public Sub StopAutoSort()
    mAutoSortOn = False
End Sub

' Called by the OnTime timer; reschedules itself while live mode is on.
Public Sub AutoSortTick()
    If Not mAutoSortOn Then Exit Sub
    ReorganizeByStatus
    ScheduleNextSort
End Sub

'------------------------------------------------------------------- internals

Private Sub ScheduleNextSort()
    ' Re-arm the timer. Wrapped in On Error so it degrades gracefully if the
    ' host build does not support Application.OnTime.
    On Error Resume Next
    Dim t As Date
    t = Now + TimeSerial(0, 0, AUTOSORT_INTERVAL)
    Application.OnTime t, "AutoSortTick"
End Sub

' Sort key: groups are Pending(1000) < Approved(2000) < Paid(3000) <
' Analysis(9000); within a group the divider (+0) sorts before members (+5).
Private Function SortKey(sld As Slide) As Long
    Dim u As String
    u = UCase(SlideText(sld))

    ' Analysis content slides (KPI / table) go to the very end.
    If InStr(u, "ANALYSIS " & Chr(151)) > 0 _
       Or InStr(u, "ANALYSIS -") > 0 _
       Or InStr(u, "MEMBERSHIP SUMMARY") > 0 _
       Or InStr(u, "BY MEMBERSHIP TYPE") > 0 Then
        SortKey = 9005
        Exit Function
    End If

    ' Member profile slide: rank by its status note.
    If InStr(u, "MEMBER PROFILE") > 0 Then
        SortKey = GroupBase(MemberStatus(sld)) + 5
        Exit Function
    End If

    ' Section divider slides (short title text).
    If IsDivider(u, "PENDING") Then SortKey = 1000: Exit Function
    If IsDivider(u, "APPROVED") Then SortKey = 2000: Exit Function
    If IsDivider(u, "PAID") Then SortKey = 3000: Exit Function
    If IsDivider(u, "ANALYSIS") Then SortKey = 9000: Exit Function

    ' Unknown slide: leave it up front, untouched.
    SortKey = 0
End Function

Private Function IsDivider(u As String, word As String) As Boolean
    ' A divider is a short slide whose title contains the section word but is
    ' not a member profile or analysis content slide.
    IsDivider = (InStr(u, word) > 0) And (Len(u) < 120) _
                And (InStr(u, "MEMBER PROFILE") = 0)
End Function

Private Function GroupBase(status As String) As Long
    Select Case status
        Case "Paid": GroupBase = 3000
        Case "Approved": GroupBase = 2000
        Case Else: GroupBase = 1000   ' Pending approval
    End Select
End Function

' Read a member slide's status from its note shapes.
Private Function MemberStatus(sld As Slide) As String
    Dim shp As Shape, t As String
    For Each shp In sld.Shapes
        If shp.HasTextFrame Then
            If shp.TextFrame.HasText Then
                t = Trim(LCase(shp.TextFrame.TextRange.Text))
                If t = "paid" Then MemberStatus = "Paid": Exit Function
                If t = "approved" Then MemberStatus = "Approved"
            End If
        End If
    Next shp
    If MemberStatus = "" Then MemberStatus = "Pending approval"
End Function

' Concatenate all text on a slide (for classification).
Private Function SlideText(sld As Slide) As String
    Dim shp As Shape, s As String
    For Each shp In sld.Shapes
        If shp.HasTextFrame Then
            If shp.TextFrame.HasText Then
                s = s & " " & shp.TextFrame.TextRange.Text
            End If
        End If
    Next shp
    SlideText = s
End Function

' After sorting, update each divider's "N member(s)" subtitle to the live count.
Private Sub RefreshDividerCounts(pres As Presentation)
    Dim nPending As Long, nApproved As Long, nPaid As Long
    Dim i As Long, u As String
    For i = 1 To pres.Slides.Count
        u = UCase(SlideText(pres.Slides(i)))
        If InStr(u, "MEMBER PROFILE") > 0 Then
            Select Case MemberStatus(pres.Slides(i))
                Case "Paid": nPaid = nPaid + 1
                Case "Approved": nApproved = nApproved + 1
                Case Else: nPending = nPending + 1
            End Select
        End If
    Next i

    SetDividerSubtitle pres, "PENDING", nPending, "Awaiting approval"
    SetDividerSubtitle pres, "APPROVED", nApproved, "Approved " & Chr(150) & " payment pending"
    SetDividerSubtitle pres, "PAID", nPaid, "Paid " & Chr(150) & " membership active"
End Sub

Private Sub SetDividerSubtitle(pres As Presentation, word As String, _
                               n As Long, tail As String)
    Dim i As Long, shp As Shape, u As String, titleShp As Shape, subShp As Shape
    For i = 1 To pres.Slides.Count
        u = UCase(SlideText(pres.Slides(i)))
        If IsDivider(u, word) And InStr(u, "ANALYSIS") = 0 Then
            ' Find the subtitle (the shape that already mentions "member").
            For Each shp In pres.Slides(i).Shapes
                If shp.HasTextFrame Then
                    If shp.TextFrame.HasText Then
                        If InStr(LCase(shp.TextFrame.TextRange.Text), "member") > 0 Then
                            shp.TextFrame.TextRange.Text = _
                                n & " member(s) " & Chr(183) & " " & tail
                        End If
                    End If
                End If
            Next shp
            Exit Sub
        End If
    Next i
End Sub
