import os
import io
from typing import List, Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem, PageBreak
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
import logging

from app.models import Question, QuestionType

logger = logging.getLogger(__name__)

class PDFGenerator:
    """Service to generate professional WAEC-style examination PDFs."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup professional examination styles."""
        # Header Style
        self.styles.add(ParagraphStyle(
            name='WAEC_Header',
            parent=self.styles['Heading1'],
            fontSize=16,
            alignment=1,  # Center
            spaceAfter=5,
            textColor=colors.black,
            fontName='Helvetica-Bold'
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='WAEC_Subtitle',
            parent=self.styles['Normal'],
            fontSize=12,
            alignment=1,  # Center
            spaceAfter=15,
            fontName='Helvetica-Bold'
        ))

        # Paper Title style
        self.styles.add(ParagraphStyle(
            name='Paper_Title',
            parent=self.styles['Heading2'],
            fontSize=14,
            alignment=1,
            spaceBefore=20,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        ))

        # Instructions style
        self.styles.add(ParagraphStyle(
            name='Instructions',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=0, # Left
            spaceAfter=15,
            fontName='Helvetica-Oblique',
            leading=12
        ))

        # Question text style
        self.styles.add(ParagraphStyle(
            name='Question_Text',
            parent=self.styles['Normal'],
            fontSize=11,
            spaceAfter=10,
            leading=14
        ))

        # Option style
        self.styles.add(ParagraphStyle(
            name='Option_Text',
            parent=self.styles['Normal'],
            fontSize=10,
            leftIndent=20,
            spaceAfter=5
        ))

        # Theory space style
        self.styles.add(ParagraphStyle(
            name='Theory_Space',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.grey,
            spaceAfter=20
        ))

    def generate_exam_pdf(
        self, 
        subject_name: str, 
        questions: List[Question], 
        organized_papers: Optional[Dict[str, List[Question]]] = None,
        year: str = "2026"
    ) -> io.BytesIO:
        """Generate a complete professional exam PDF."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            rightMargin=inch/2,
            leftMargin=inch/2,
            topMargin=inch/2,
            bottomMargin=inch/2
        )
        
        elements = []
        
        # 1. Main Header
        elements.append(Paragraph("WEST AFRICAN EXAMINATIONS COUNCIL", self.styles['WAEC_Header']))
        elements.append(Paragraph(f"BroxStudies OFFICIAL MOCK EXAMINATION — {year}", self.styles['WAEC_Subtitle']))
        elements.append(Paragraph(subject_name.upper(), self.styles['WAEC_Header']))
        
        # Candidate Info Box placeholder
        data = [['CANDIDATE NAME:', '________________________________________________'],
                ['INDEX NUMBER:', '________________________________________________']]
        t = Table(data, colWidths=[1.5*inch, 4.5*inch])
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('PADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        # 2. Process Papers
        papers_to_render = []
        if organized_papers:
            # Sort papers logically: 1, 2, 3
            for pk in ['paper_1', 'paper_2', 'paper_3']:
                if organized_papers.get(pk):
                    papers_to_render.append((pk, organized_papers[pk]))
        else:
            # Fallback if not organized
            papers_to_render.append(("FULL PAPER", questions))

        for paper_key, paper_questions in papers_to_render:
            paper_label = self._get_paper_label(paper_key)
            
            # Paper Header
            elements.append(Paragraph(paper_label, self.styles['Paper_Title']))
            elements.append(Paragraph(self._get_instructions(paper_key), self.styles['Instructions']))
            
            # Questions
            for i, q in enumerate(paper_questions):
                # Question Number & Text
                elements.append(Paragraph(f"<b>{i+1}.</b> {q.question_text}", self.styles['Question_Text']))
                
                # Render options if MCQ
                if q.question_type == QuestionType.MULTIPLE_CHOICE and q.options:
                    for j, opt in enumerate(q.options):
                        letter = chr(65 + j)
                        # Clean option text (remove possible prefixes)
                        import re
                        cleaned_opt = re.sub(r'^(Option\s+[A-D][:.]\s*|[A-D][:.]\s*)', '', opt, flags=re.IGNORECASE).strip()
                        elements.append(Paragraph(f"({letter}) {cleaned_opt}", self.styles['Option_Text']))
                    elements.append(Spacer(1, 10))
                
                # Render space for Theory if requested
                elif q.question_type in [QuestionType.ESSAY, QuestionType.SHORT_ANSWER]:
                    # Add answer space lines
                    elements.append(Spacer(1, 10))
                    # Create a "box" or lines for answering
                    lines = 15 # default lines for essay
                    for _ in range(lines):
                        elements.append(Paragraph("____________________________________________________________________________________", self.styles['Theory_Space']))
                    elements.append(Spacer(1, 15))

            # Page break after Paper 1 or 2
            if paper_key != papers_to_render[-1][0]:
                elements.append(PageBreak())

        # Build PDF
        doc.build(elements, onFirstPage=self._add_footer, onLaterPages=self._add_footer)
        buffer.seek(0)
        return buffer

    def _add_footer(self, canvas: canvas.Canvas, doc):
        """Add page numbers and professional footers."""
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        footer_text = "Page %d of %s | BroxStudies Educational Resources | WASSCE Prep" % (doc.page, "...") # Simplified doc page count
        canvas.drawCentredString(A4[0]/2, 30, footer_text)
        canvas.restoreState()

    def _get_paper_label(self, paper_key: str) -> str:
        labels = {
            'paper_1': "PAPER 1 - OBJECTIVE TEST",
            'paper_2': "PAPER 2 - THEORY / STRUCTURED QUESTIONS",
            'paper_3': "PAPER 3 - PRACTICAL / ALTERNATIVE TO PRACTICAL",
            'FULL PAPER': "GENERAL EXAMINATION"
        }
        return labels.get(paper_key, paper_key.replace('_', ' ').upper())

    def _get_instructions(self, paper_key: str) -> str:
        instructions = {
            'paper_1': "INSTRUCTIONS: Answer ALL questions in this section. Each question is followed by four options lettered A to D. Choose the correct option.",
            'paper_2': "INSTRUCTIONS: Answer any THREE questions from this section unless otherwise stated. Your answers should be clear and concise. Show all working where necessary.",
            'paper_3': "INSTRUCTIONS: Follow the specific practical directions provided. Record all observations clearly.",
            'FULL PAPER': "INSTRUCTIONS: Answer questions as directed in each sub-section."
        }
        return instructions.get(paper_key, "Answer questions accordingly.")
