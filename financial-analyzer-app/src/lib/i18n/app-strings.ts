/**
 * Hand-authored UI strings for the app's functional pages (/pro, /training)
 * and result labels. These are NOT in keel-landing's marketing dictionary, so
 * they're translated here into proper French / Arabic financial terminology.
 * The verbatim marketing copy still lives in dictionaries.ts.
 */
export const en = {
  nav_training: "Training",

  // ---- Pro analyzer: page + sections ----
  pro_h1: "Pro Analyzer",
  pro_lead:
    "Enter your income statement and balance sheet below. Every ratio is computed by our tested calculation engine — the AI only writes the narrative around the numbers you see.",
  sec_company: "Company",
  sec_income: "Income statement",
  sec_balance: "Balance sheet",
  f_company_name: "Company name",
  f_business_type: "Business type",
  f_currency: "Currency",

  // income statement fields
  f_revenue: "Revenue",
  f_cogs: "Cost of goods sold (COGS)",
  f_opex: "Operating expenses (excl. D&A)",
  f_dep: "Depreciation",
  f_interest: "Interest expense",
  f_tax: "Tax expense",
  // balance sheet fields
  f_cash: "Cash",
  f_ar: "Accounts receivable",
  f_inventory: "Inventory",
  f_ppe: "Property, plant & equipment (net)",
  f_ap: "Accounts payable",
  f_std: "Short-term debt",
  f_ltd: "Long-term debt",
  f_equity: "Equity",

  // business types
  bt_generic: "Generic",
  bt_retail: "Retail",
  bt_restaurant: "Restaurant",
  bt_saas: "SaaS",
  bt_manufacturing: "Manufacturing",
  bt_services: "Services",
  bt_ecommerce: "E-commerce",

  // buttons + status
  btn_analyze: "Analyze",
  btn_analyzing: "Analyzing…",
  err_generic: "Something went wrong. Please try again.",

  // results
  r_sample: "Sample report — add an Anthropic API key for the full AI analysis.",
  r_warnings: "Data-quality warnings",
  r_summary: "Summary",
  r_ratios: "Ratios",
  r_ai_report: "AI report",
  sl_net_income: "Net income",
  sl_gross_profit: "Gross profit",
  sl_ebitda: "EBITDA",
  sl_ebit: "EBIT",
  sl_total_assets: "Total assets",
  sl_total_liabilities: "Total liabilities",
  sl_working_capital: "Working capital",
  sl_balance_check: "Balance check",
  r_balanced: "Balanced",
  r_off_by: "Off by",

  // ratio groups
  g_profitability: "Profitability",
  g_liquidity: "Liquidity",
  g_solvency: "Solvency",
  g_efficiency: "Efficiency",

  // ratio metric labels (keyed m_<engine key>)
  m_gross_margin: "Gross margin",
  m_operating_margin: "Operating margin (EBIT)",
  m_ebitda_margin: "EBITDA margin",
  m_net_margin: "Net profit margin",
  m_roa: "Return on assets (ROA)",
  m_roe: "Return on equity (ROE)",
  m_roic: "Return on invested capital (ROIC)",
  m_current_ratio: "Current ratio",
  m_quick_ratio: "Quick ratio (acid test)",
  m_cash_ratio: "Cash ratio",
  m_working_capital: "Working capital",
  m_debt_to_equity: "Debt-to-equity",
  m_debt_ratio: "Debt ratio",
  m_equity_ratio: "Equity ratio",
  m_interest_coverage: "Interest coverage",
  m_net_debt: "Net debt",
  m_inventory_turnover: "Inventory turnover",
  m_receivables_turnover: "Receivables turnover",
  m_asset_turnover: "Asset turnover",
  m_dio: "Days inventory outstanding",
  m_dso: "Days sales outstanding",
  m_dpo: "Days payable outstanding",
  m_cash_conversion_cycle: "Cash conversion cycle",

  // ---- Training ----
  tr_eye: "Free & open",
  tr_h1: "Free training & practice",
  tr_lead:
    "Sharpen your financial-analysis skills with practice cases built on the same verified engine that powers the Pro Analyzer. No account required — this area is free for everyone.",
  tr_lead2:
    "Scored quizzes and guided walkthroughs for each practice case are coming soon. For now, browse the case library below.",
  lvl_beginner: "Beginner",
  lvl_intermediate: "Intermediate",
  lvl_advanced: "Advanced",
  case1_t: "Diagnose a liquidity squeeze",
  case1_d:
    "A retail chain's current ratio has been sliding for two quarters. Read the balance sheet and work out what's driving it.",
  case2_t: "Read a growth-stage balance sheet",
  case2_d:
    "High revenue growth, negative net margin. Separate the metrics that matter for a SaaS business from the ones that don't — yet.",
  case3_t: "Spot the leverage risk",
  case3_d:
    "Interest coverage is thinning and debt-to-equity is climbing. Decide whether this manufacturer can safely fund its next expansion.",
  case4_t: "Working capital under pressure",
  case4_d:
    "Inventory turnover looks healthy, but payables are stretching out. Trace the cash-conversion cycle to find the real story.",
  btn_quiz_soon: "Quiz coming soon",
  tr_cta_h2: "Want to analyze your own numbers?",
  tr_cta_p:
    "The Pro Analyzer runs the exact same verified engine on your real income statement and balance sheet, then writes a full AI report.",
  tr_cta_btn: "Open the Pro Analyzer",
} as const;

export const fr: Record<keyof typeof en, string> = {
  nav_training: "Formation",

  pro_h1: "Analyseur Pro",
  pro_lead:
    "Saisissez votre compte de résultat et votre bilan ci-dessous. Chaque ratio est calculé par notre moteur de calcul testé — l'IA ne fait que rédiger le récit autour des chiffres que vous voyez.",
  sec_company: "Entreprise",
  sec_income: "Compte de résultat",
  sec_balance: "Bilan",
  f_company_name: "Nom de l'entreprise",
  f_business_type: "Type d'activité",
  f_currency: "Devise",

  f_revenue: "Chiffre d'affaires",
  f_cogs: "Coût des marchandises vendues (CMV)",
  f_opex: "Charges d'exploitation (hors amort.)",
  f_dep: "Amortissements",
  f_interest: "Charges d'intérêts",
  f_tax: "Charge d'impôt",
  f_cash: "Trésorerie",
  f_ar: "Créances clients",
  f_inventory: "Stocks",
  f_ppe: "Immobilisations corporelles (nettes)",
  f_ap: "Dettes fournisseurs",
  f_std: "Dette à court terme",
  f_ltd: "Dette à long terme",
  f_equity: "Capitaux propres",

  bt_generic: "Générique",
  bt_retail: "Commerce de détail",
  bt_restaurant: "Restaurant",
  bt_saas: "SaaS",
  bt_manufacturing: "Industrie",
  bt_services: "Services",
  bt_ecommerce: "E-commerce",

  btn_analyze: "Analyser",
  btn_analyzing: "Analyse en cours…",
  err_generic: "Une erreur est survenue. Veuillez réessayer.",

  r_sample:
    "Rapport d'exemple — ajoutez une clé API Anthropic pour l'analyse IA complète.",
  r_warnings: "Avertissements sur la qualité des données",
  r_summary: "Synthèse",
  r_ratios: "Ratios",
  r_ai_report: "Rapport IA",
  sl_net_income: "Résultat net",
  sl_gross_profit: "Bénéfice brut",
  sl_ebitda: "EBITDA",
  sl_ebit: "EBIT",
  sl_total_assets: "Total de l'actif",
  sl_total_liabilities: "Total du passif",
  sl_working_capital: "Fonds de roulement",
  sl_balance_check: "Contrôle d'équilibre",
  r_balanced: "Équilibré",
  r_off_by: "Écart de",

  g_profitability: "Rentabilité",
  g_liquidity: "Liquidité",
  g_solvency: "Solvabilité",
  g_efficiency: "Efficacité",

  m_gross_margin: "Marge brute",
  m_operating_margin: "Marge opérationnelle (EBIT)",
  m_ebitda_margin: "Marge d'EBITDA",
  m_net_margin: "Marge nette",
  m_roa: "Rentabilité des actifs (ROA)",
  m_roe: "Rentabilité des capitaux propres (ROE)",
  m_roic: "Rentabilité du capital investi (ROIC)",
  m_current_ratio: "Ratio de liquidité générale",
  m_quick_ratio: "Ratio de liquidité réduite",
  m_cash_ratio: "Ratio de liquidité immédiate",
  m_working_capital: "Fonds de roulement",
  m_debt_to_equity: "Dette / capitaux propres",
  m_debt_ratio: "Ratio d'endettement",
  m_equity_ratio: "Ratio d'autonomie financière",
  m_interest_coverage: "Couverture des intérêts",
  m_net_debt: "Dette nette",
  m_inventory_turnover: "Rotation des stocks",
  m_receivables_turnover: "Rotation des créances",
  m_asset_turnover: "Rotation de l'actif",
  m_dio: "Délai d'écoulement des stocks",
  m_dso: "Délai de recouvrement des créances",
  m_dpo: "Délai de paiement des fournisseurs",
  m_cash_conversion_cycle: "Cycle de conversion de trésorerie",

  tr_eye: "Gratuit et ouvert",
  tr_h1: "Formation et exercices gratuits",
  tr_lead:
    "Perfectionnez vos compétences en analyse financière avec des cas pratiques bâtis sur le même moteur vérifié que l'Analyseur Pro. Aucun compte requis — cet espace est gratuit pour tous.",
  tr_lead2:
    "Des quiz notés et des parcours guidés pour chaque cas pratique arrivent bientôt. Pour l'instant, parcourez la bibliothèque de cas ci-dessous.",
  lvl_beginner: "Débutant",
  lvl_intermediate: "Intermédiaire",
  lvl_advanced: "Avancé",
  case1_t: "Diagnostiquer une tension de liquidité",
  case1_d:
    "Le ratio de liquidité générale d'une chaîne de commerce baisse depuis deux trimestres. Lisez le bilan et déterminez ce qui l'explique.",
  case2_t: "Lire le bilan d'une entreprise en croissance",
  case2_d:
    "Forte croissance du chiffre d'affaires, marge nette négative. Distinguez les indicateurs qui comptent pour une entreprise SaaS de ceux qui ne comptent pas — encore.",
  case3_t: "Repérer le risque d'endettement",
  case3_d:
    "La couverture des intérêts s'amenuise et le ratio dette / capitaux propres grimpe. Déterminez si cet industriel peut financer sereinement sa prochaine expansion.",
  case4_t: "Fonds de roulement sous pression",
  case4_d:
    "La rotation des stocks paraît saine, mais les délais fournisseurs s'allongent. Suivez le cycle de conversion de trésorerie pour trouver la vraie histoire.",
  btn_quiz_soon: "Quiz bientôt disponible",
  tr_cta_h2: "Envie d'analyser vos propres chiffres ?",
  tr_cta_p:
    "L'Analyseur Pro applique exactement le même moteur vérifié à votre véritable compte de résultat et à votre bilan, puis rédige un rapport IA complet.",
  tr_cta_btn: "Ouvrir l'Analyseur Pro",
};

export const ar: Record<keyof typeof en, string> = {
  nav_training: "التدريب",

  pro_h1: "المحلّل الاحترافي",
  pro_lead:
    "أدخل قائمة الدخل والميزانية العمومية أدناه. كل نسبة يحسبها محرّك الحساب المُختبَر لدينا — والذكاء الاصطناعي يكتب السرد حول الأرقام التي تراها فقط.",
  sec_company: "الشركة",
  sec_income: "قائمة الدخل",
  sec_balance: "الميزانية العمومية",
  f_company_name: "اسم الشركة",
  f_business_type: "نوع النشاط",
  f_currency: "العملة",

  f_revenue: "الإيرادات",
  f_cogs: "تكلفة البضاعة المباعة",
  f_opex: "المصاريف التشغيلية (بدون الإهلاك والاستهلاك)",
  f_dep: "الإهلاك",
  f_interest: "مصاريف الفوائد",
  f_tax: "مصروف الضريبة",
  f_cash: "النقد",
  f_ar: "الذمم المدينة",
  f_inventory: "المخزون",
  f_ppe: "الممتلكات والمنشآت والمعدات (صافي)",
  f_ap: "الذمم الدائنة",
  f_std: "الديون قصيرة الأجل",
  f_ltd: "الديون طويلة الأجل",
  f_equity: "حقوق الملكية",

  bt_generic: "عام",
  bt_retail: "تجزئة",
  bt_restaurant: "مطاعم",
  bt_saas: "برمجيات SaaS",
  bt_manufacturing: "تصنيع",
  bt_services: "خدمات",
  bt_ecommerce: "تجارة إلكترونية",

  btn_analyze: "حلّل",
  btn_analyzing: "جارٍ التحليل…",
  err_generic: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",

  r_sample: "تقرير نموذجي — أضِف مفتاح Anthropic API للحصول على التحليل الكامل بالذكاء الاصطناعي.",
  r_warnings: "تنبيهات جودة البيانات",
  r_summary: "الملخص",
  r_ratios: "النسب",
  r_ai_report: "تقرير الذكاء الاصطناعي",
  sl_net_income: "صافي الدخل",
  sl_gross_profit: "الربح الإجمالي",
  sl_ebitda: "EBITDA",
  sl_ebit: "EBIT",
  sl_total_assets: "إجمالي الأصول",
  sl_total_liabilities: "إجمالي الخصوم",
  sl_working_capital: "رأس المال العامل",
  sl_balance_check: "التحقق من التوازن",
  r_balanced: "متوازن",
  r_off_by: "فرق قدره",

  g_profitability: "الربحية",
  g_liquidity: "السيولة",
  g_solvency: "الملاءة",
  g_efficiency: "الكفاءة",

  m_gross_margin: "الهامش الإجمالي",
  m_operating_margin: "هامش التشغيل (EBIT)",
  m_ebitda_margin: "هامش EBITDA",
  m_net_margin: "هامش صافي الربح",
  m_roa: "العائد على الأصول (ROA)",
  m_roe: "العائد على حقوق الملكية (ROE)",
  m_roic: "العائد على رأس المال المستثمر (ROIC)",
  m_current_ratio: "نسبة التداول",
  m_quick_ratio: "نسبة السيولة السريعة",
  m_cash_ratio: "نسبة النقد",
  m_working_capital: "رأس المال العامل",
  m_debt_to_equity: "الدين إلى حقوق الملكية",
  m_debt_ratio: "نسبة الدين",
  m_equity_ratio: "نسبة حقوق الملكية",
  m_interest_coverage: "تغطية الفوائد",
  m_net_debt: "صافي الدين",
  m_inventory_turnover: "معدل دوران المخزون",
  m_receivables_turnover: "معدل دوران الذمم المدينة",
  m_asset_turnover: "معدل دوران الأصول",
  m_dio: "أيام بقاء المخزون",
  m_dso: "أيام تحصيل المبيعات",
  m_dpo: "أيام سداد الدائنين",
  m_cash_conversion_cycle: "دورة تحويل النقد",

  tr_eye: "مجاني ومفتوح",
  tr_h1: "تدريب وتمارين مجانية",
  tr_lead:
    "طوّر مهاراتك في التحليل المالي عبر حالات تدريبية مبنية على المحرّك المُختبَر نفسه الذي يشغّل المحلّل الاحترافي. لا حاجة إلى حساب — هذه المنطقة مجانية للجميع.",
  tr_lead2:
    "اختبارات مُقيَّمة وشروحات موجَّهة لكل حالة تدريبية قادمة قريبًا. في الوقت الحالي، تصفّح مكتبة الحالات أدناه.",
  lvl_beginner: "مبتدئ",
  lvl_intermediate: "متوسط",
  lvl_advanced: "متقدم",
  case1_t: "تشخيص أزمة سيولة",
  case1_d:
    "ظلّت نسبة التداول لسلسلة متاجر تجزئة تتراجع منذ ربعين. اقرأ الميزانية العمومية واستنتج السبب وراء ذلك.",
  case2_t: "قراءة ميزانية شركة في مرحلة النمو",
  case2_d:
    "نمو مرتفع في الإيرادات وصافي هامش سالب. ميّز المؤشرات المهمة لشركة SaaS عن تلك التي لا تهم — بعد.",
  case3_t: "رصد مخاطر الرافعة المالية",
  case3_d:
    "تغطية الفوائد تتضاءل ونسبة الدين إلى حقوق الملكية ترتفع. قرّر ما إذا كان بإمكان هذا المصنّع تمويل توسّعه القادم بأمان.",
  case4_t: "رأس المال العامل تحت الضغط",
  case4_d:
    "يبدو معدل دوران المخزون سليمًا، لكن مهل سداد الدائنين تتمدد. تتبّع دورة تحويل النقد لتكتشف القصة الحقيقية.",
  btn_quiz_soon: "الاختبار قريبًا",
  tr_cta_h2: "تريد تحليل أرقامك الخاصة؟",
  tr_cta_p:
    "يطبّق المحلّل الاحترافي المحرّك المُختبَر نفسه تمامًا على قائمة دخلك وميزانيتك الحقيقية، ثم يكتب تقريرًا كاملًا بالذكاء الاصطناعي.",
  tr_cta_btn: "افتح المحلّل الاحترافي",
};
