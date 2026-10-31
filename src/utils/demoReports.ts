import { DocumentCategory, Report } from '../types/report';
import { cleanReportText, chunkReportPages, extractTablesFromPages } from './ragEngine';

const INDIA_REPORT_PAGES = [
  {
    pageNumber: 1,
    pdfPageIndex: 0,
    printedPageLabel: 'Page 1 (Exec. Summary)',
    sectionTitle: 'Executive Summary: National Demographic & Economic Overview 2026',
    text: `Executive Summary: National Demographic & Economic Overview 2026

According to the Ministry of Statistics and Programme Implementation (MoSPI) National Statistical Compendium 2026, India's total population reached 1,441.7 million as of March 1, 2026, reflecting a decadal deceleration in annual population growth rate to 0.89% per annum (down from 1.25% in 2011).

Urbanization accelerated significantly over the reporting period: the urban population share stood at 36.8% (530.5 million residents), while the rural population accounted for 63.2% (911.2 million residents). The national median age rose to 29.4 years, with 67.8% of the total population within the working-age bracket (15–64 years), sustaining a favorable demographic dividend window through 2045.`,
  },
  {
    pageNumber: 2,
    pdfPageIndex: 1,
    printedPageLabel: 'Page 2 (Ch. 1)',
    sectionTitle: 'Chapter 1: Decadal Population Growth & Fertility Transition',
    text: `Chapter 1: Decadal Population Growth & Fertility Transition

The Total Fertility Rate (TFR) across India declined from 2.4 children per woman in 2011 to 1.96 children per woman in 2026, remaining below the replacement threshold of 2.1 for the fourth consecutive survey year. Infant Mortality Rate (IMR) dropped to 23.4 per 1,000 live births, and life expectancy at birth reached 71.8 years (70.3 years for males and 73.4 years for females).

Table 1.1: National Demographic & Vital Indicators (2011 vs 2021 vs 2026)
| Indicator | Unit | 2011 Census | 2021 Survey | 2026 Official |
| Total Population | Million | 1,210.9 | 1,367.2 | 1,441.7 |
| Urban Population Share | % | 31.16 | 34.93 | 36.80 |
| Annual Population Growth | % | 1.64 | 1.04 | 0.89 |
| Total Fertility Rate (TFR) | Births/Woman | 2.40 | 2.05 | 1.96 |
| Life Expectancy at Birth | Years | 67.1 | 69.9 | 71.8 |`,
  },
  {
    pageNumber: 3,
    pdfPageIndex: 2,
    printedPageLabel: 'Page 3 (Ch. 2)',
    sectionTitle: 'Chapter 2: State-Level Performance, Literacy & Digital Inclusion',
    text: `Chapter 2: State-Level Performance, Literacy & Digital Inclusion

The national effective literacy rate (population aged 7 years and above) increased during the reporting period to 81.2% in 2026, up from 74.04% in 2011. Male literacy reached 86.7%, while female literacy recorded a 9.9 percentage point improvement from 65.46% in 2011 to 75.4% in 2026, narrowing the gender literacy gap from 16.68 percentage points to 11.3 percentage points. Rural literacy rate stood at 76.8% in 2026.

Among individual states, Kerala recorded the highest literacy rate and ranked as the highest-performing state in human development at 96.2% (female literacy 95.4%), followed by Tamil Nadu as the highest-performing state in Higher Education Gross Enrolment Ratio (51.8% GER) and Maharashtra as the highest-performing state in nominal GSDP contribution (₹42.6 lakh crore). Household broadband internet penetration climbed to 78.6% nationally (91.2% in urban centers and 71.4% in rural gram panchayats).

Table 2.1: State-Tier Literacy & Digital Connectivity Benchmarks (2026)
| Region / State Cluster | Literacy Rate (%) | Female Literacy (%) | Higher Ed GER (%) | Rural Broadband (%) |
| All-India Aggregate | 81.2 | 75.4 | 31.4 | 71.4 |
| Kerala (Top Literacy State) | 96.2 | 95.4 | 43.6 | 94.8 |
| Tamil Nadu (Top GER State) | 86.8 | 82.9 | 51.8 | 88.4 |
| Southern States Cluster | 87.9 | 84.1 | 41.2 | 86.5 |
| Western & Coastal Cluster | 85.4 | 80.2 | 35.8 | 79.8 |
| Northern & Central Cluster | 77.6 | 70.8 | 27.9 | 65.2 |`,
  },
  {
    pageNumber: 4,
    pdfPageIndex: 3,
    printedPageLabel: 'Page 4 (Ch. 3)',
    sectionTitle: 'Chapter 3: Macroeconomic Output, Fiscal Balance & Employment',
    text: `Chapter 3: Macroeconomic Output, Fiscal Balance & Employment

Real Gross Domestic Product (GDP) expanded by 7.2% in FY 2025–26, reaching nominal GDP of USD 4,280 billion (₹357.4 lakh crore). Per capita nominal net national income rose to ₹2,14,850 (USD 2,575). Consumer Price Index (CPI) headline inflation averaged 4.3% over the 12-month period, remaining within the Reserve Bank tolerance band of 4% ± 2%.

The Periodic Labour Force Survey (PLFS) 2026 recorded a Labour Force Participation Rate (LFPR) of 59.6% for persons aged 15 years and above. Female Labour Force Participation Rate (FLFPR) increased from 23.3% in 2017–18 to 41.7% in 2026, driven by rural self-employment collectives and formal digital services. The national unemployment rate on usual status declined to 3.1%.

Table 3.1: Macroeconomic & Fiscal Performance Indicators (FY 2022 vs FY 2024 vs FY 2026)
| Macroeconomic Metric | Unit | FY 2022 | FY 2024 | FY 2026 |
| Real GDP Growth Rate | % | 6.99 | 8.20 | 7.20 |
| Nominal GDP | USD Billion | 3,353 | 3,732 | 4,280 |
| CPI Headline Inflation | % | 6.70 | 5.36 | 4.30 |
| Fiscal Deficit (% of GDP) | % | 6.71 | 5.63 | 4.45 |
| Female Labour Participation | % | 32.8 | 37.0 | 41.7 |`,
  },
  {
    pageNumber: 5,
    pdfPageIndex: 4,
    printedPageLabel: 'Page 5 (Ch. 4)',
    sectionTitle: 'Chapter 4: Clean Energy Transition & Grid Infrastructure',
    text: `Chapter 4: Clean Energy Transition & Grid Infrastructure

Total installed non-fossil fuel electricity generation capacity reached 214.6 GW as of March 2026, accounting for 46.8% of total national installed power capacity (458.5 GW). India's installed solar photovoltaic capacity stood at 104.8 GW in 2026, wind power capacity at 51.2 GW, large hydro at 47.4 GW, and nuclear plus biomass at 11.2 GW.

Grid-scale battery energy storage systems (BESS) commissioned 6.8 GWh of operational capacity in FY 2025–26, reducing peak evening thermal curtailment by 14.2%. National carbon emissions intensity per unit of GDP declined by 36.4% relative to 2005 baseline levels, surpassing the interim 2026 milestone ahead of schedule.

Table 4.1: Installed Power Generation Capacity by Source (GW)
| Generation Source | Unit | 2020 Capacity | 2023 Capacity | 2026 Capacity |
| Solar Photovoltaic | GW | 34.6 | 66.8 | 104.8 |
| Wind Power | GW | 37.7 | 42.6 | 51.2 |
| Large Hydroelectric | GW | 45.7 | 46.8 | 47.4 |
| Total Renewable & Non-Fossil | GW | 134.1 | 178.9 | 214.6 |`,
  },
  {
    pageNumber: 6,
    pdfPageIndex: 5,
    printedPageLabel: 'Page 6 (Ch. 5)',
    sectionTitle: 'Chapter 5: Digital Public Infrastructure & Financial Inclusion',
    text: `Chapter 5: Digital Public Infrastructure & Financial Inclusion

Unified Payments Interface (UPI) processed 168.4 billion transactions in FY 2025–26 with a cumulative transaction value of ₹246.8 lakh crore (USD 2.96 trillion), representing a 28.4% year-over-year volume expansion. Active Jan Dhan bank accounts reached 542.6 million, of which 56.1% are held by women account holders in rural and semi-urban districts.

Direct Benefit Transfer (DBT) pipelines disbursed ₹7.82 lakh crore across 318 central and state welfare schemes in FY 2025–26, achieving cumulative audited leakage savings of ₹3.48 lakh crore through Aadhaar-authenticated beneficiary deduplication.`,
  },
  {
    pageNumber: 7,
    pdfPageIndex: 6,
    printedPageLabel: 'Page 7 (Ch. 6)',
    sectionTitle: 'Chapter 6: National Healthcare Infrastructure, District Hospitals & Ayushman Digital Mission',
    text: `Chapter 6: National Healthcare Infrastructure, District Hospitals & Ayushman Digital Mission

Across all 36 states and union territories, operational Ayushman Bharat Health and Wellness Centres (HWCs) reached 174,820 facilities as of March 2026, delivering 2.84 billion cumulative primary care teleconsultations. Public District Hospital bed capacity expanded to 1,480,000 beds in 2026 (up from 1,090,000 beds in 2021), while the National Maternal Mortality Ratio (MMR) declined to 88 per 100,000 live births.

Verified Digital Health IDs (ABHA accounts) linked to electronic medical records reached 684.5 million citizens, and public expenditure on primary and secondary healthcare rose to 2.35% of GDP in FY 2025–26.`,
  },
  {
    pageNumber: 8,
    pdfPageIndex: 7,
    printedPageLabel: 'Page 8 (Ch. 7)',
    sectionTitle: 'Chapter 7: Agricultural Productivity, Foodgrain Reserves & Micro-Irrigation',
    text: `Chapter 7: Agricultural Productivity, Foodgrain Reserves & Micro-Irrigation

Total national foodgrain production reached a record 341.6 million tonnes in agricultural year 2025–26, supported by 18.9 million hectares of newly commissioned drip and sprinkler micro-irrigation coverage. Cold-chain logistics capacity expanded to 44.2 million metric tonnes, reducing post-harvest horticultural losses from 11.4% to 6.8%.`,
  },
  {
    pageNumber: 9,
    pdfPageIndex: 8,
    printedPageLabel: 'Page 9 (Ch. 8)',
    sectionTitle: 'Chapter 8: National Highways, Dedicated Freight Corridors & Urban Metro Rail',
    text: `Chapter 8: National Highways, Dedicated Freight Corridors & Urban Metro Rail

The National Highway network expanded to 148,500 kilometers as of March 2026, with high-speed access-controlled expressways accounting for 6,420 kilometers. Operational urban metro rail systems spanned 1,045 kilometers across 23 metropolitan cities, carrying an average daily ridership of 11.8 million passengers.`,
  },
  {
    pageNumber: 10,
    pdfPageIndex: 9,
    printedPageLabel: 'Page 10 (Ch. 9)',
    sectionTitle: 'Chapter 9: Statistical Methodology, Sampling Frame & Audit Annexures',
    text: `Chapter 9: Statistical Methodology, Sampling Frame & Audit Annexures

The 2026 National Statistical Compendium synthesizes household enumerations across 784 districts, 642,000 rural villages, and 8,450 urban frame blocks using computer-assisted personal interviewing (CAPI). All district-level aggregates satisfy a relative standard error (RSE) threshold below 1.25% at the 95% confidence interval.`,
  },
];

const GLOBAL_ENERGY_PAGES = [
  {
    pageNumber: 1,
    pdfPageIndex: 0,
    printedPageLabel: 'Page 1 (Exec. Review)',
    sectionTitle: 'Executive Summary: Global Clean Energy Statistical Review 2026',
    text: `Executive Summary: Global Clean Energy Statistical Review 2026

According to the International Energy Statistical Agency (IESA) 2026 Annual Compendium, global renewable power capacity additions reached 584 GW in calendar year 2025, bringing cumulative worldwide renewable generation capacity to 4,462 GW as of January 2026. Clean energy investment totaled USD 2,140 billion globally, outpacing fossil fuel supply investment by a ratio of 2.1 to 1.

Global utility-scale lithium-iron-phosphate (LFP) battery pack prices fell to a record low of USD 112 per kWh in 2026, down from USD 151 per kWh in 2022, unlocking 118 GWh of new grid-forming storage installations across Asia, Europe, and North America.`,
  },
  {
    pageNumber: 2,
    pdfPageIndex: 1,
    printedPageLabel: 'Page 2 (Regional Audit)',
    sectionTitle: 'Chapter 1: Regional Renewable Capacity & Storage Costs',
    text: `Chapter 1: Regional Renewable Capacity & Storage Costs

Zero-carbon electricity sources (solar, wind, hydro, nuclear, geothermal) generated 42.6% of total global electricity output (13,180 TWh out of 30,940 TWh) in 2025–26. Solar PV alone contributed 74% of all newly commissioned renewable capacity worldwide. According to IESA satellite-audited grid registries, India's installed solar photovoltaic capacity stood at 112.4 GW in 2026 across utility and industrial arrays.

Table 1.1: Global Clean Energy & Storage Benchmarks (2020 vs 2023 vs 2026)
| Global Energy Indicator | Unit | 2020 | 2023 | 2026 |
| Annual Renewable Additions | GW | 289 | 473 | 584 |
| Cumulative Renewable Capacity | GW | 2,838 | 3,870 | 4,462 |
| Battery Pack Average Cost | USD/kWh | 148 | 139 | 112 |
| Clean Energy Investment | USD Billion | 1,280 | 1,840 | 2,140 |`,
  },
];

function buildDemoReport(
  reportId: string,
  title: string,
  fileName: string,
  fileSize: number,
  agency: string,
  publicationYear: string,
  category: DocumentCategory,
  collectionName: string,
  rawPages: {
    pageNumber: number;
    pdfPageIndex?: number;
    printedPageLabel?: string;
    sectionTitle: string;
    text: string;
  }[],
  suggestedQuestions: string[]
): Report {
  const pages = rawPages.map((p) => ({
    pageNumber: p.pageNumber,
    pdfPageIndex: p.pdfPageIndex ?? p.pageNumber - 1,
    printedPageLabel: p.printedPageLabel || `Page ${p.pageNumber}`,
    sectionTitle: p.sectionTitle,
    rawText: p.text,
    cleanedText: cleanReportText(p.text),
    wordCount: p.text.split(/\s+/).length,
    sourceType: 'native_pdf_text' as const,
  }));

  const chunks = chunkReportPages(rawPages, reportId);
  const tables = extractTablesFromPages(rawPages, reportId);

  const insights = [
    {
      id: `${reportId}_ins_1`,
      category: 'statistic' as const,
      title: rawPages[0].sectionTitle,
      detail:
        reportId === 'demo_india_census_2026'
          ? "India's total population reached 1,441.7 million in March 2026 with annual growth slowing to 0.89%."
          : 'Global renewable power additions hit 584 GW, lifting cumulative capacity to 4,462 GW.',
      metricValue: reportId === 'demo_india_census_2026' ? '1,441.7M' : '4,462 GW',
      pageNumber: 1,
      chunkId: chunks[0]?.chunkId || `${reportId}_p1_c1`,
      supportingPassage: chunks[0]?.originalText || rawPages[0].text,
    },
    {
      id: `${reportId}_ins_2`,
      category: 'trend' as const,
      title: rawPages[1].sectionTitle,
      detail:
        reportId === 'demo_india_census_2026'
          ? 'Total Fertility Rate (TFR) declined from 2.40 in 2011 to 1.96 births per woman in 2026, below the 2.1 replacement threshold.'
          : 'Utility-scale battery pack prices dropped to USD 112/kWh in 2026, down 24.3% from 2020 levels.',
      metricValue: reportId === 'demo_india_census_2026' ? '1.96 TFR' : '$112/kWh',
      pageNumber: 2,
      chunkId: chunks.find((c) => c.pageNumber === 2)?.chunkId || chunks[0]?.chunkId || '',
      supportingPassage: chunks.find((c) => c.pageNumber === 2)?.originalText || rawPages[1].text,
    },
    ...(reportId === 'demo_india_census_2026'
      ? [
          {
            id: `${reportId}_ins_3`,
            category: 'finding' as const,
            title: 'State-Level Leaders & Literacy Rise',
            detail:
              'National effective literacy reached 81.2% in 2026, led by Kerala (96.2% literacy), Tamil Nadu (51.8% Higher Ed GER), and Maharashtra (₹42.6L Cr GSDP).',
            metricValue: '96.2% Top State',
            pageNumber: 3,
            chunkId: chunks.find((c) => c.pageNumber === 3)?.chunkId || '',
            supportingPassage:
              chunks.find((c) => c.pageNumber === 3)?.originalText || rawPages[2].text,
          },
          {
            id: `${reportId}_ins_4`,
            category: 'comparison' as const,
            title: 'Real GDP Expansion & Fiscal Consolidation',
            detail:
              'Real GDP grew 7.20% in FY 2026 (USD 4,280 billion nominal), while fiscal deficit narrowed from 6.71% in FY 2022 to 4.45% in FY 2026.',
            metricValue: '7.20% GDP',
            pageNumber: 4,
            chunkId: chunks.find((c) => c.pageNumber === 4)?.chunkId || '',
            supportingPassage:
              chunks.find((c) => c.pageNumber === 4)?.originalText || rawPages[3].text,
          },
          {
            id: `${reportId}_ins_5`,
            category: 'observation' as const,
            title: 'Healthcare Infrastructure & District Hospitals (Page 7)',
            detail:
              'Operational Ayushman Bharat Health and Wellness Centres reached 174,820 facilities and District Hospital beds expanded to 1,480,000 on Page 7.',
            metricValue: '174,820 HWCs',
            pageNumber: 7,
            chunkId: chunks.find((c) => c.pageNumber === 7)?.chunkId || '',
            supportingPassage:
              chunks.find((c) => c.pageNumber === 7)?.originalText || rawPages[6].text,
          },
        ]
      : []),
  ];

  const summary =
    reportId === 'demo_india_census_2026'
      ? {
          overview:
            'The 10-page MoSPI National Statistical & Demographic Survey 2026 provides official audited benchmarks across population dynamics, state-level literacy and education, macroeconomic output, clean energy capacity, digital public infrastructure, healthcare facilities (Page 7), agricultural output (Page 8), and transport networks (Page 9).',
          mainObjectives: [
            {
              text: 'Establish official 2026 demographic and urbanization baselines (Total population: 1,441.7 million; Urban share: 36.8%).',
              pageNumber: 1,
            },
            {
              text: 'Evaluate decadal shifts in fertility (TFR 1.96), life expectancy (71.8 years), and state-tier literacy (Kerala 96.2%, All-India 81.2%).',
              pageNumber: 3,
            },
            {
              text: 'Audit FY 2025–26 macroeconomic growth (7.2% real GDP), clean power transition (214.6 GW non-fossil), and public healthcare capacity (1,480,000 District Hospital beds on Page 7).',
              pageNumber: 7,
            },
          ],
          keyFindings: [
            {
              text: "India's total population reached 1,441.7 million in March 2026, with annual population growth slowing to 0.89%.",
              pageNumber: 1,
            },
            {
              text: 'Total Fertility Rate (TFR) fell to 1.96 births per woman, below replacement fertility of 2.1.',
              pageNumber: 2,
            },
            {
              text: 'National literacy rose to 81.2% (Female: 75.4%), with Kerala leading in literacy (96.2%), Tamil Nadu in Higher Ed GER (51.8%), and Maharashtra in GSDP (₹42.6 lakh crore).',
              pageNumber: 3,
            },
            {
              text: 'Operational Ayushman Bharat Health and Wellness Centres reached 174,820 facilities and District Hospital capacity expanded to 1,480,000 beds.',
              pageNumber: 7,
            },
          ],
          importantStatistics: [
            {
              label: 'Total Population (2026)',
              value: '1,441.7 Million',
              context: '0.89% annual growth; 36.8% urban share (530.5M urban, 911.2M rural).',
              pageNumber: 1,
            },
            {
              label: 'National & State Literacy',
              value: '81.2% (Kerala 96.2%)',
              context: 'Up from 74.04% in 2011; Female literacy rose to 75.4% nationally.',
              pageNumber: 3,
            },
            {
              label: 'District Hospital Beds',
              value: '1,480,000 Beds',
              context: '174,820 Health & Wellness Centres operational; MMR declined to 88.',
              pageNumber: 7,
            },
            {
              label: 'Non-Fossil Power Capacity',
              value: '214.6 GW',
              context: '46.8% of total power grid; includes 104.8 GW solar PV and 51.2 GW wind.',
              pageNumber: 5,
            },
          ],
          conclusions: [
            {
              text: 'Demographic stabilization (TFR 1.96) combined with expanding female labor participation (41.7%) and healthcare capacity (Page 7) positions the economy for productivity-led growth.',
              pageNumber: 7,
            },
            {
              text: 'Rapid solar PV expansion (104.8 GW) and 6.8 GWh of grid battery storage reduced emissions intensity by 36.4% from 2005 levels.',
              pageNumber: 5,
            },
          ],
        }
      : {
          overview:
            'The IESA Global Clean Energy Statistical Review 2026 tracks worldwide renewable generation additions (584 GW), battery storage cost reductions ($112/kWh), and clean energy capital deployment ($2,140B).',
          mainObjectives: [
            {
              text: 'Quantify 2025–26 global renewable capacity additions (584 GW) and cumulative installed capacity (4,462 GW).',
              pageNumber: 1,
            },
            {
              text: 'Track utility-scale LFP battery pack cost declines ($112/kWh) and regional solar PV registries (India at 112.4 GW including industrial rooftop arrays).',
              pageNumber: 2,
            },
          ],
          keyFindings: [
            {
              text: 'Global renewable additions hit 584 GW, bringing cumulative capacity to 4,462 GW.',
              pageNumber: 1,
            },
            {
              text: 'Battery storage pack costs fell to USD 112/kWh, enabling 118 GWh of new grid storage.',
              pageNumber: 2,
            },
          ],
          importantStatistics: [
            {
              label: 'Cumulative Renewable Capacity',
              value: '4,462 GW',
              context: '584 GW added in the latest reporting year.',
              pageNumber: 1,
            },
            {
              label: 'Battery Pack Cost',
              value: 'USD 112/kWh',
              context: 'Down from USD 148/kWh in 2020.',
              pageNumber: 2,
            },
          ],
          conclusions: [
            {
              text: 'Zero-carbon power now supplies 42.6% of global electricity, led by solar PV (74% of new additions).',
              pageNumber: 2,
            },
          ],
        };

  return {
    reportId,
    title,
    fileName,
    fileSize,
    pageCount: rawPages.length,
    uploadedAt: '2026-10-30T07:30:00Z',
    isDemo: true,
    status: 'ready',
    agency,
    publicationYear,
    category,
    collectionName,
    pages,
    chunks,
    tables,
    insights,
    summary,
    suggestedQuestions,
  };
}

export const DEMO_REPORTS: Report[] = [
  buildDemoReport(
    'demo_india_census_2026',
    'India National Statistical & Demographic Survey 2026 (MoSPI)',
    'MoSPI_National_Statistical_Compendium_2026.pdf',
    1842600,
    'Ministry of Statistics & Programme Implementation (MoSPI)',
    '2026',
    'Demographics & Census',
    'National Statistical Compendiums',
    INDIA_REPORT_PAGES,
    [
      'How many operational Health and Wellness Centres and District Hospital beds were recorded on Page 7?',
      'Find the highest-performing state.',
      'Summarize this report.',
      'Find the most important statistics.',
      'Compare the data from two years.',
      'Explain this table.',
      "What was India's total population according to this report?",
      'What was Mars GDP in 2026? (Test unsupported refusal)',
    ]
  ),
  buildDemoReport(
    'demo_global_energy_2026',
    'Global Clean Energy & Grid Storage Compendium 2026 (IESA)',
    'IESA_Global_Clean_Energy_Review_2026.pdf',
    964200,
    'International Energy Statistical Agency (IESA)',
    '2026',
    'Energy & Climate',
    'Clean Energy & Climate Transitions',
    GLOBAL_ENERGY_PAGES,
    [
      'Summarize this report.',
      'Find the most important statistics.',
      'Compare the data from two years.',
      'What was the cumulative global renewable capacity in 2026?',
      'How much did battery pack costs fall between 2020 and 2026?',
    ]
  ),
];

/**
 * Generates a valid, standards-compliant 10-page binary PDF file in memory
 * so users and automated tests can upload a 10-page PDF and verify Page 7 citation navigation.
 */
export function createSampleGovernmentPdfBlob(
  customTitle = 'Fiscal & Healthcare Infrastructure Audit Report 2026'
): File {
  const samplePages = [
    `${customTitle.trim()} - Page 1: Executive Overview. Total public capital expenditure reached USD 142.8 billion in FY 2026, an increase of 18.4% over FY 2024.`,
    `Section 2: Regional Budget Allocation Table (Page 2). | Sector | Unit | FY 2024 | FY 2026 | | Transport & Highways | USD Billion | 64.2 | 78.5 | | Clean Water & Grids | USD Billion | 56.4 | 64.3 |`,
    `Section 3: Demographic & Literacy Benchmarks (Page 3). The national literacy rate increased during the reporting period to 81.2% in 2026, with Kerala recording the highest literacy rate at 96.2%.`,
    `Section 4: Macroeconomic & Fiscal Balance (Page 4). Real GDP expanded by 7.2% in FY 2026 to USD 4,280 billion, while the fiscal deficit narrowed to 4.45% of GDP.`,
    `Section 5: Renewable Energy & Grid Storage (Page 5). Installed non-fossil electricity capacity reached 214.6 GW in 2026, including 104.8 GW of solar photovoltaic capacity.`,
    `Section 6: Digital Public Infrastructure & UPI (Page 6). Unified Payments Interface processed 168.4 billion transactions in FY 2026 valued at INR 246.8 lakh crore.`,
    `Section 7: National Healthcare Infrastructure & District Hospitals (Page 7). Operational Ayushman Bharat Health and Wellness Centres reached 174,820 facilities as of March 2026, and public District Hospital bed capacity expanded to 1,480,000 beds while the Maternal Mortality Ratio declined to 88 per 100,000 live births.`,
    `Section 8: Agricultural Productivity & Micro-Irrigation (Page 8). Total foodgrain production reached 341.6 million tonnes in 2025-26 across 18.9 million hectares of micro-irrigated farmland.`,
    `Section 9: National Highways & Urban Metro Rail (Page 9). National highway network expanded to 148,500 km and operational urban metro rail systems spanned 1,045 km across 23 cities.`,
    `Section 10: Statistical Methodology & Sampling Audit (Page 10). Survey enumerations covered 784 districts with a relative standard error below 1.25% at the 95% confidence interval.`,
  ];

  const escapePdf = (str: string) => str.replace(/([()\\])/g, '\\$1');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
  ];

  const pageObjIds: string[] = [];
  const fontObjId = 3 + samplePages.length * 2;

  for (let i = 0; i < samplePages.length; i++) {
    const pageObjNum = 3 + i * 2;
    const contentObjNum = pageObjNum + 1;
    pageObjIds.push(`${pageObjNum} 0 R`);
  }

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.join(' ')}] /Count ${samplePages.length} >>\nendobj`
  );

  for (let i = 0; i < samplePages.length; i++) {
    const pageObjNum = 3 + i * 2;
    const contentObjNum = pageObjNum + 1;
    const text = samplePages[i];
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${text.length + 45} >>\nstream\nBT /F1 11 Tf 50 700 Td (${escapePdf(text)}) Tj ET\nendstream\nendobj`
    );
  }

  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  return new File([blob], 'Fiscal_Healthcare_Audit_10Pages_2026.pdf', { type: 'application/pdf' });
}
