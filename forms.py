"""
Waiver form definitions — the single source of truth for every Katara Club
digital waiver.

Both the web form (static/waiver.html, via GET /api/forms/{id}) and the PDF
generator (waiver.py) read from here, so a form only ever has to be defined once.
Add a new waiver (sauna, gym, pool, spa, …) by appending an entry to FORMS.
"""

# Each form:
#   id        — short slug used in URLs and stored on submissions
#   title     — {en, ar}
#   subtitle  — {en, ar}
#   section   — {en, ar}  (the "Acknowledgment & Consent" heading)
#   note      — {en, ar}  (the "reserves the right to refuse" footer line)
#   clauses   — list of {en, ar} acknowledgements (each gets a Yes/No toggle)

FORMS = {
    "K11-AIR-SELECT": {
        "id": "K11-AIR-SELECT",
        "title": {
            "en": "11 Air Select Machine User Waiver & Consent Form",
            "ar": "نموذج إقرار وموافقة الاستخدام",
        },
        "subtitle": {
            "en": "This waiver applies to all members using the K11 Air Select Machine.",
            "ar": "يطبق هذا الإقرار على جميع المستخدمين (الأعضاء) لجهاز العناية الضوئية",
        },
        "section": {"en": "Acknowledgment & Consent", "ar": "الإقرار والموافقة"},
        "note": {
            "en": "Katara Club reserves the right to refuse equipment use if safety requirements are not met.",
            "ar": "يحتفظ نادي كتارا بالحق في منع استخدام الجهاز في حال عدم الالتزام بإرشادات السلامة",
        },
        "clauses": [
            {"en": "I confirm that I am 18+ and have no medical condition preventing UV exposure.",
             "ar": "أؤكد أن عمري ١٨ سنة أو أكثر ولا أعاني من حالة صحية تمنع التعرض للأشعة فوق البنفسجية"},
            {"en": "If female: I confirm that I am not pregnant and understand that this treatment is strictly prohibited during pregnancy.",
             "ar": "إذا كنتِ أنثى، أؤكد أنني لست حاملاً، وأدرك أن هذا العلاج محظور تماماً أثناء فترة الحمل"},
            {"en": "I voluntarily choose to use the tanning machine, understanding the risks.",
             "ar": "أستخدم الجهاز بمحض إرادتي وبعد فهم كامل للمخاطر المحتملة"},
            {"en": "I am not using medication increasing UV sensitivity and have not been advised to avoid tanning.",
             "ar": "لا أستخدم أدوية أو منتجات تزيد حساسية الجلد للأشعة ولم يتم نصحي طبياً بتجنب التسمير"},
            {"en": "I understand UV exposure may cause skin and eye burns, irritation, or increase skin health risks.",
             "ar": "أقر بأن جهاز التسمير يعرض الجلد والعينين للأشعة فوق البنفسجية وقد يسبب حروقاً أو تهيجاً أو يزيد خطر مشاكل الجلد"},
            {"en": "I agree to follow staff instructions and wear protective eyewear during the session.",
             "ar": "ألتزم باتباع تعليمات موظفي النادي واستخدام نظارات حماية العين طوال الجلسة"},
            {"en": "I agree to follow recommended exposure time and use the equipment safely.",
             "ar": "ألتزم بالمدة المحددة للجلسة واستخدام الجهاز بطريقة آمنة ومسؤولة"},
            {"en": "I confirm that I will avoid using the sauna, facial, ice plunge, and sun exposure for at least 24 hours "
                   "following my session, in accordance with Katara Club safety guidelines.",
             "ar": "أؤكد أنني سأمتنع عن استخدام الساونا، فيشل، حوض الثلج، والتعرض المباشر لأشعة الشمس لمدة لا تقل عن ٢٤ ساعة بعد الجلسة، وفقاً لإرشادات السلامة الخاصة بنادي كتارا"},
            {"en": "I accept full responsibility and acknowledge Katara Club is not liable when safety instructions are not followed.",
             "ar": "أتحمل المسؤولية الكاملة عن استخدام الجهاز وأقر بعدم مسؤولية نادي كتارا عن أي آثار ناتجة عن الاستخدام عند عدم الالتزام بالتعليمات"},
            {"en": "I confirm that I have read, understood, and agreed to all terms above.",
             "ar": "أؤكد أنني قرأت وفهمت جميع البنود وأوافق عليها بالكامل"},
        ],
    },
}

DEFAULT_FORM_ID = "K11-AIR-SELECT"


def get_form(form_id: str | None) -> dict:
    """Return a form definition, falling back to the default form."""
    return FORMS.get(form_id or DEFAULT_FORM_ID, FORMS[DEFAULT_FORM_ID])
