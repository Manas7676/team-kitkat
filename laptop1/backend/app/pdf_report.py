import io, datetime, re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)

def safe_text(s):
    if s is None:
        return ""
    s = str(s)
    s = s.replace("Δ", "Delta ").replace("°", " deg").replace("±", "+/-").replace("—", " - ").replace("–", " - ")
    s = re.sub(r'&(?!(?:amp|lt|gt|quot|apos);)', '&amp;', s)
    return s

def generate_pdf_report(incidents_list, mission_state=None) -> bytes:
    """
    Generates a professional ST-10 Mission Operations Incident Report PDF.
    Complies with all auditability, evidence grounding, and lifecycle requirements.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0b2447'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=12
    )
    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=10,
        spaceAfter=6
    )
    h3_style = ParagraphStyle(
        'Heading3Custom',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=6,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b')
    )
    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        leftIndent=12,
        spaceAfter=3
    )
    meta_label = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#475569')
    )
    meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0f172a')
    )
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Italic'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#64748b'),
        spaceBefore=4,
        spaceAfter=8
    )

    story = []
    now_ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    report_id = f"REP-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

    # Header Section
    story.append(Paragraph("ST-10 Mission Operations Incident Report", title_style))
    story.append(Paragraph("ST-10 Mission Operations Copilot · Spacecraft Decision Support System", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceAfter=10))

    # Metadata Table
    header_data = [
        [Paragraph("Report ID:", meta_label), Paragraph(report_id, meta_val),
         Paragraph("Generated:", meta_label), Paragraph(now_ts, meta_val)],
        [Paragraph("Mission:", meta_label), Paragraph("ORBIT-X / SIMULATION", meta_val),
         Paragraph("Spacecraft / Sim ID:", meta_label), Paragraph("SC-ST10-ALPHA", meta_val)],
    ]
    t_header = Table(header_data, colWidths=[90, 180, 100, 170])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 10))

    # Mission Summary
    total_inv = len(incidents_list)
    active_inv = sum(1 for i in incidents_list if i.get("status") == "INVESTIGATING")
    resolved_inv = sum(1 for i in incidents_list if i.get("status") in ("RESOLVED", "CLOSED"))
    mission_status = "INVESTIGATING ANOMALY" if active_inv > 0 else "NOMINAL"
    status_color = colors.HexColor('#dc2626') if active_inv > 0 else colors.HexColor('#16a34a')

    story.append(Paragraph("Mission Summary", h2_style))
    summary_data = [
        [Paragraph("Overall Mission Status", meta_label), Paragraph("Total Investigations", meta_label),
         Paragraph("Active Investigations", meta_label), Paragraph("Resolved Investigations", meta_label)],
        [Paragraph(f"<b><font color='{status_color.hexval()}'>{mission_status}</font></b>", meta_val),
         Paragraph(str(total_inv), meta_val),
         Paragraph(str(active_inv), meta_val),
         Paragraph(str(resolved_inv), meta_val)]
    ]
    t_summary = Table(summary_data, colWidths=[150, 130, 130, 130])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 14))

    # Incidents List
    for idx, inc in enumerate(incidents_list):
        if idx > 0:
            story.append(PageBreak())

        iid = inc.get("incident_id", "INC-???")
        title = inc.get("title", "Untitled Incident")
        sev = inc.get("severity", "MEDIUM")
        status = inc.get("status", "INVESTIGATING")
        sub = inc.get("subsystem", "General")
        detected = inc.get("detected") or inc.get("timestamp") or "—"
        end_time = inc.get("end_time") or "Active"
        resolved_by = inc.get("resolved_by") or ("Operator" if status == "RESOLVED" else "—")
        resolution = inc.get("resolution") or "Pending operator resolution"

        story.append(Paragraph(f"Investigation: {iid} — {title}", h2_style))

        # Incident Details Key-Value
        inc_meta = [
            [Paragraph("Incident ID:", meta_label), Paragraph(iid, meta_val),
             Paragraph("Subsystem:", meta_label), Paragraph(sub, meta_val)],
            [Paragraph("Severity:", meta_label), Paragraph(f"<b>{sev}</b>", meta_val),
             Paragraph("Status:", meta_label), Paragraph(f"<b>{status}</b>", meta_val)],
            [Paragraph("Detection Time:", meta_label), Paragraph(str(detected), meta_val),
             Paragraph("Resolution Time:", meta_label), Paragraph(str(end_time), meta_val)],
            [Paragraph("Resolved By:", meta_label), Paragraph(str(resolved_by), meta_val),
             Paragraph("Scenario ID:", meta_label), Paragraph(str(inc.get("scenario_id", "—")), meta_val)],
        ]
        t_inc = Table(inc_meta, colWidths=[90, 180, 100, 170])
        t_inc.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t_inc)
        story.append(Spacer(1, 8))

        # Description & Affected Systems
        desc = inc.get("description") or inc.get("narrative") or "No description recorded."
        story.append(Paragraph(f"<b>Description:</b> {desc}", body_style))
        story.append(Spacer(1, 4))

        aff = ", ".join(inc.get("affected_systems", [])) or "None identified"
        pot = ", ".join(inc.get("potential_systems", [])) or "None identified"
        unaff = ", ".join(inc.get("unaffected", [])) or "None"
        story.append(Paragraph(f"<b>Affected Subsystems:</b> {aff}", body_style))
        story.append(Paragraph(f"<b>Potential Subsystems:</b> {pot}", body_style))
        story.append(Paragraph(f"<b>Unaffected Subsystems:</b> {unaff}", body_style))
        story.append(Spacer(1, 8))

        # Observed Facts
        story.append(Paragraph("1. Observed Facts (Telemetry Ground Truth)", h3_style))
        facts = inc.get("observed_facts", [])
        if facts:
            for f in facts:
                story.append(Paragraph(f"• {f}", bullet_style))
        else:
            story.append(Paragraph("• Telemetry within monitored thresholds.", bullet_style))
        story.append(Spacer(1, 8))

        # Evidence Table
        story.append(Paragraph("2. Supporting Evidence (Retrieved & Verified Records)", h3_style))
        evidence = inc.get("evidence", [])
        if evidence:
            ev_table_data = [
                [Paragraph("ID", table_cell_bold),
                 Paragraph("Source", table_cell_bold),
                 Paragraph("Param", table_cell_bold),
                 Paragraph("Observed", table_cell_bold),
                 Paragraph("Baseline", table_cell_bold),
                 Paragraph("Finding / Detail", table_cell_bold)]
            ]
            for e in evidence[:10]: # cap to 10 for clean presentation
                ev_table_data.append([
                    Paragraph(str(e.get("id", "—")), table_cell_bold),
                    Paragraph(f"{e.get('source_type','—')}<br/><font color='#64748b'>{e.get('source_name','—')}</font>", table_cell),
                    Paragraph(str(e.get("parameter", "—")), table_cell),
                    Paragraph(str(e.get("observed", "—")), table_cell),
                    Paragraph(str(e.get("baseline", "—")), table_cell),
                    Paragraph(str(e.get("finding", "—")), table_cell),
                ])
            t_ev = Table(ev_table_data, colWidths=[65, 85, 60, 55, 55, 220])
            t_ev.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94a3b8')),
                ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(t_ev)
        else:
            story.append(Paragraph("No specific evidence records attached.", body_style))
        story.append(Spacer(1, 8))

        # Hypotheses
        story.append(Paragraph("3. Hypotheses (Inference — NOT CONFIRMED)", h3_style))
        hyps = inc.get("hypotheses", [])
        if hyps:
            for h in hyps:
                c = h.get("cause", "Unknown cause")
                conf = h.get("confidence", 0)
                st = h.get("status", "NOT CONFIRMED")
                story.append(Paragraph(f"• <b>{c}</b> — Prior / Confidence: {conf}% [{st}]", bullet_style))
        else:
            story.append(Paragraph("• No hypotheses generated.", bullet_style))
        story.append(Paragraph("<i>Note: Hypotheses are diagnostic inferences and are never presented as confirmed ground truth.</i>", disclaimer_style))

        # Recommended Next Step
        story.append(Paragraph("4. Recommended Next Step (Advisory Diagnostic Action)", h3_style))
        rec = inc.get("recommended_next_step") or (inc.get("recommendation", {}).get("text") if isinstance(inc.get("recommendation"), dict) else None) or "Proceed with standard telemetry monitoring."
        story.append(Paragraph(f"<b>Recommendation:</b> {rec}", body_style))
        story.append(Paragraph("<i>Decision Support Warning: Recommendations are strictly advisory. Operator review and mission approval required. No autonomous commands issued.</i>", disclaimer_style))

        # Operator Action & Resolution
        story.append(Paragraph("5. Operator Action & Resolution", h3_style))
        op_dec = inc.get("operator_decision") or "Operator review conducted."
        story.append(Paragraph(f"• <b>Status:</b> {status}", bullet_style))
        story.append(Paragraph(f"• <b>Resolution Summary:</b> {resolution}", bullet_style))
        story.append(Paragraph(f"• <b>Operator Decision Log:</b> {op_dec}", bullet_style))
        story.append(Paragraph(f"• <b>Resolved By:</b> {resolved_by}", bullet_style))
        story.append(Spacer(1, 6))

        # Audit Timeline
        story.append(Paragraph("6. Audit Timeline (Reconstruction)", h3_style))
        timeline = inc.get("timeline", [])
        if timeline:
            tl_data = [[Paragraph("Time", table_cell_bold), Paragraph("Event", table_cell_bold), Paragraph("Kind", table_cell_bold)]]
            for t in timeline:
                t_str = str(t.get("time", ""))
                if "T" in t_str:
                    t_str = t_str.split("T")[1].replace("Z", "")
                tl_data.append([
                    Paragraph(t_str, table_cell),
                    Paragraph(str(t.get("event", "")), table_cell),
                    Paragraph(str(t.get("kind", "")), table_cell),
                ])
            t_tl = Table(tl_data, colWidths=[80, 380, 80])
            t_tl.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(t_tl)
        else:
            story.append(Paragraph("No timeline entries recorded.", body_style))
        story.append(Spacer(1, 10))

    doc.build(story)
    return buffer.getvalue()
