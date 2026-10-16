"""Generate the downloadable, text-selectable resume from the shared content."""
import json
import shutil
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
resume = data['resume']
output = ROOT / 'output/pdf/Saif_Chamakhi_Resume.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
ink, muted, line, accent = map(colors.HexColor, ['#18212b', '#536171', '#d4dce4', '#85551b'])
def clean(text):
    for a, b in [('–', '-'), ('—', '-'), ('’', "'"), ('·', '|')]:
        text = text.replace(a, b)
    return escape(text)
styles = {
    'name': ParagraphStyle('name', fontName='Helvetica-Bold', fontSize=25, leading=29, textColor=ink, spaceAfter=5),
    'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=accent, spaceAfter=8),
    'contact': ParagraphStyle('contact', fontName='Helvetica', fontSize=9, leading=13, textColor=muted, spaceAfter=10),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10, leading=13.5, textColor=ink, spaceAfter=5),
    'section': ParagraphStyle('section', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=accent, spaceBefore=7, spaceAfter=5),
    'role': ParagraphStyle('role', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=ink),
    'date': ParagraphStyle('date', fontName='Helvetica', fontSize=9, leading=13, textColor=muted, alignment=TA_RIGHT),
    'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=9, leading=12, textColor=muted, spaceAfter=5),
    'bullet': ParagraphStyle('bullet', fontName='Helvetica', fontSize=10, leading=13.2, textColor=ink, leftIndent=10, firstLineIndent=-10, spaceAfter=3),
    'skill': ParagraphStyle('skill', fontName='Helvetica', fontSize=9.5, leading=13, textColor=ink, spaceAfter=4),
}
para = lambda text, style='body': Paragraph(text, styles[style])
def url(href, label): return f'<link href="{escape(href, {chr(34): "&quot;"})}" color="#365c77">{clean(label)}</link>'
story = [para(clean(p['name']), 'name'), para('UNITY DEVELOPER | GAMEPLAY, UI SYSTEMS &amp; MULTIPLAYER', 'title')]
story.append(para(f'{clean(p["location"])} | {clean(p["phone"])} | {url("mailto:"+p["email"],p["email"])}<br/>' + ' | '.join([url('https://saifxss.github.io/', 'Portfolio & case studies'), url(p['linkedin'], 'LinkedIn'), url(p['github'], 'GitHub')]), 'contact'))
story.append(para(clean(resume['summary']), 'body'))
story.append(para('CORE TOOLKIT', 'section'))
for skill in resume['skills']:
    story.append(para(f'<b>{clean(skill["label"])}:</b> {clean(skill["text"])}', 'skill'))
story.append(para('PROFESSIONAL EXPERIENCE', 'section'))
for role in resume['experience']:
    heading = Table([[para(clean(role['studio']), 'role'), para(clean(role['dates']), 'date')]], colWidths=[333, 174], hAlign='LEFT')
    heading.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0), ('TOPPADDING',(0,0),(-1,-1),0), ('BOTTOMPADDING',(0,0),(-1,-1),2)]))
    block = [heading, para(clean(role['role']), 'subtitle')]
    for bullet in role['bullets']:
        block.append(para('- ' + clean(bullet), 'bullet'))
    block.append(Spacer(1, 5))
    story.append(KeepTogether(block))
story.append(para('<b>Tools built:</b> ' + clean(resume['tools']), 'skill'))
education = [para('EDUCATION & LANGUAGES', 'section')]
degree = data['education'][0]
education.append(para(f'<b>{clean(degree["title"])}</b> | {clean(degree["institution"])} | {clean(degree["dates"])}<br/>' + ' | '.join(clean(l['name']+' - '+l['level']) for l in data['languages']), 'skill'))

story.append(KeepTogether(education))

def footer(canvas, doc):
    canvas.setStrokeColor(line); canvas.line(44, 30, A4[0]-44, 30)
    canvas.setFont('Helvetica', 8); canvas.setFillColor(muted)
    canvas.drawString(44, 18, 'Saif Chamakhi | Unity Developer')
    canvas.drawRightString(A4[0]-44, 18, str(doc.page))

doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=38, rightMargin=38, topMargin=30, bottomMargin=36, title='Saif Chamakhi - Unity Developer', author='Saif Chamakhi', pageCompression=1)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
shutil.copyfile(output, ROOT / p['resume'])
print(output)
