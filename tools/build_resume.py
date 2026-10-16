"""Generate the downloadable, text-selectable resume from the shared content."""
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/portfolio.json').read_text(encoding='utf-8'))
p = data['profile']
output = ROOT / p['resume']
ink, muted, line, accent = map(colors.HexColor, ['#18212b', '#536171', '#d4dce4', '#85551b'])
def clean(text):
    for a, b in [('–', '-'), ('—', '-'), ('’', "'"), ('·', '|')]:
        text = text.replace(a, b)
    return escape(text)
styles = {
    'name': ParagraphStyle('name', fontName='Helvetica-Bold', fontSize=25, leading=29, textColor=ink, spaceAfter=5),
    'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=accent, spaceAfter=8),
    'contact': ParagraphStyle('contact', fontName='Helvetica', fontSize=9, leading=13, textColor=muted, spaceAfter=10),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=9.5, leading=13.3, textColor=ink, spaceAfter=7),
    'section': ParagraphStyle('section', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=accent, spaceBefore=10, spaceAfter=7),
    'role': ParagraphStyle('role', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=ink),
    'date': ParagraphStyle('date', fontName='Helvetica', fontSize=9, leading=13, textColor=muted, alignment=TA_RIGHT),
    'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=9, leading=12, textColor=muted, spaceAfter=5),
    'bullet': ParagraphStyle('bullet', fontName='Helvetica', fontSize=9.4, leading=13, textColor=ink, leftIndent=10, firstLineIndent=-10, spaceAfter=4),
    'skill': ParagraphStyle('skill', fontName='Helvetica', fontSize=9, leading=13, textColor=ink, spaceAfter=4),
}
para = lambda text, style='body': Paragraph(text, styles[style])
def url(href, label): return f'<link href="{escape(href, {chr(34): "&quot;"})}" color="#365c77">{clean(label)}</link>'
story = [para(clean(p['name']), 'name'), para('UNITY DEVELOPER | GAMEPLAY, UI SYSTEMS &amp; MULTIPLAYER', 'title')]
story.append(para(f'{clean(p["location"])} | {clean(p["phone"])} | {url("mailto:"+p["email"],p["email"])}<br/>' + ' | '.join([url('https://saifxss.github.io/', 'Portfolio & case studies'), url(p['linkedin'], 'LinkedIn'), url(p['github'], 'GitHub')]), 'contact'))
story.append(para(clean(p['intro']) + ' ' + clean(p['availability']) + '.', 'body'))
story.append(para('CORE TOOLKIT', 'section'))
for label, values in [
    ('Gameplay & architecture', 'Unity, C#, event-driven systems, ScriptableObjects, state machines, Minimax / Alpha-Beta'),
    ('UI & multiplayer', 'Unity UI / Canvas, reusable interfaces, Photon Fusion, Photon Quantum, WebGL'),
    ('Performance & delivery', 'Unity Profiler, Addressables, texture compression, Android, Steam, Git, REST APIs'),
]:
    story.append(para(f'<b>{clean(label)}:</b> {clean(values)}', 'skill'))
story.append(para('PROFESSIONAL EXPERIENCE', 'section'))
for role in data['experience']:
    heading = Table([[para(clean(role['studio']), 'role'), para(clean(role['dates']), 'date')]], colWidths=[340, 179])
    heading.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0), ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),2)]))
    block = [heading, para(clean(role['role']), 'subtitle')]
    for bullet in role['bullets']:
        block.append(para('- ' + clean(bullet), 'bullet'))
    block.append(Spacer(1, 7))
    story.append(KeepTogether(block))
releases = [project for project in data['projects'] if project['status'] == 'released']
story.append(para('<b>Public releases:</b> ' + ' | '.join(url('https://saifxss.github.io/projects/'+project['slug']+'/', project['title']) for project in releases), 'skill'))
story.append(para('EDUCATION & LANGUAGES', 'section'))
degree = data['education'][0]
story.append(para(f'<b>{clean(degree["title"])}</b> | {clean(degree["institution"])} | {clean(degree["dates"])}<br/>' + ' | '.join(clean(l['name']+' - '+l['level']) for l in data['languages']), 'skill'))

def footer(canvas, doc):
    canvas.setStrokeColor(line); canvas.line(38, 30, A4[0]-38, 30)
    canvas.setFont('Helvetica', 8); canvas.setFillColor(muted)
    canvas.drawString(38, 18, 'Saif Chamakhi | Unity Developer')
    canvas.drawRightString(A4[0]-38, 18, str(doc.page))

doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=38, rightMargin=38, topMargin=33, bottomMargin=42, title='Saif Chamakhi - Unity Developer', author='Saif Chamakhi', pageCompression=1)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(output)
