// Curated list of notable Indian market personalities and their known holdings
// Sources: SEBI filings, annual reports, public disclosures

export interface NotableHolder {
  name: string;
  type: "Promoter" | "Politician" | "Celebrity" | "HNI" | "Institutional" | "Government" | "FII";
  description: string;
  holdings: { symbol: string; shares?: number; percentHeld?: number; approxValue?: string; note?: string }[];
}

export const NOTABLE_HOLDERS: NotableHolder[] = [
  // ─── Promoters & Business Leaders ───
  {
    name: "Mukesh Ambani & Family",
    type: "Promoter",
    description: "Chairman of Reliance Industries. India's richest person. Promoter holding ~50%.",
    holdings: [
      { symbol: "RELIANCE", percentHeld: 50.33, note: "Promoter & Promoter Group" },
    ],
  },
  {
    name: "Gautam Adani & Family",
    type: "Promoter",
    description: "Chairman of Adani Group. Promoter of multiple Adani listed entities.",
    holdings: [
      { symbol: "ADANIENT", percentHeld: 72.63, note: "Promoter holding" },
      { symbol: "ADANIPORTS", percentHeld: 65.25, note: "Promoter holding" },
      { symbol: "ADANIPOWER", percentHeld: 75.0, note: "Promoter holding" },
      { symbol: "ADANIGREEN", percentHeld: 56.41, note: "Promoter holding" },
    ],
  },
  {
    name: "Ratan Tata (Tata Trusts)",
    type: "Promoter",
    description: "Tata Trusts hold ~66% of Tata Sons, which controls the Tata Group companies.",
    holdings: [
      { symbol: "TCS", percentHeld: 72.3, note: "Via Tata Sons" },
      { symbol: "TATAMOTORS", percentHeld: 46.3, note: "Via Tata Sons" },
      { symbol: "TATASTEEL", percentHeld: 33.9, note: "Via Tata Sons" },
      { symbol: "TITAN", percentHeld: 25.02, note: "Via Tata Sons" },
      { symbol: "TATAPOWER", percentHeld: 46.86, note: "Via Tata Sons" },
    ],
  },
  {
    name: "Azim Premji & Family",
    type: "Promoter",
    description: "Founder of Wipro. Philanthropist. One of India's wealthiest individuals.",
    holdings: [
      { symbol: "WIPRO", percentHeld: 72.9, note: "Promoter & Premji Invest" },
    ],
  },
  {
    name: "Kumar Mangalam Birla",
    type: "Promoter",
    description: "Chairman of Aditya Birla Group. Controls UltraTech, Grasim, Vodafone Idea.",
    holdings: [
      { symbol: "ULTRACEMCO", percentHeld: 59.29, note: "Via Aditya Birla Group" },
      { symbol: "GRASIM", percentHeld: 43.0, note: "Promoter" },
      { symbol: "HINDALCO", percentHeld: 34.71, note: "Via Aditya Birla Group" },
      { symbol: "IDEA", percentHeld: 37.0, note: "Promoter (Vodafone Idea)" },
    ],
  },
  {
    name: "N. R. Narayana Murthy",
    type: "HNI",
    description: "Co-founder of Infosys. Tech industry legend. Now invests via Catamaran Ventures.",
    holdings: [
      { symbol: "INFY", percentHeld: 0.39, note: "Personal + Catamaran Ventures" },
    ],
  },
  {
    name: "Uday Kotak",
    type: "Promoter",
    description: "Founder of Kotak Mahindra Bank. Billionaire banker & investor.",
    holdings: [
      { symbol: "KOTAKBANK", percentHeld: 25.89, note: "Promoter holding" },
    ],
  },
  {
    name: "Shiv Nadar & Family",
    type: "Promoter",
    description: "Founder of HCL Technologies. Philanthropist. Major tech industry figure.",
    holdings: [
      { symbol: "HCLTECH", percentHeld: 60.81, note: "Promoter holding" },
    ],
  },

  // ─── Legendary Investors / HNIs ───
  {
    name: "Late Rakesh Jhunjhunwala (Rare Enterprises)",
    type: "HNI",
    description: "India's Warren Buffett. Portfolio managed by Rare Enterprises after his passing. Known for long-term value picks.",
    holdings: [
      { symbol: "TITAN", percentHeld: 5.04, note: "Flagship holding" },
      { symbol: "TATACOMM", percentHeld: 5.98, note: "Long-term bet" },
      { symbol: "CRISIL", percentHeld: 5.39, note: "Financial services" },
      { symbol: "NAZARA", percentHeld: 10.09, note: "Gaming/tech bet" },
      { symbol: "IIFL", percentHeld: 4.86, note: "Financial services" },
    ],
  },
  {
    name: "Radhakishan Damani",
    type: "HNI",
    description: "Founder of DMart (Avenue Supermarts). Billionaire investor known for retail & consumer picks.",
    holdings: [
      { symbol: "DMART", percentHeld: 74.99, note: "Promoter of DMart" },
      { symbol: "VSTIND", percentHeld: 32.49, note: "Major stake" },
      { symbol: "INDIACEM", percentHeld: 20.0, note: "Value pick" },
    ],
  },
  {
    name: "Dolly Khanna",
    type: "HNI",
    description: "Chennai-based super investor. Known for small/mid-cap multibagger picks. Followed by retail investors.",
    holdings: [
      { symbol: "TTML", percentHeld: 1.2, note: "Known holding" },
      { symbol: "KPRMILL", percentHeld: 1.56, note: "Textile bet" },
      { symbol: "NIITLTD", percentHeld: 2.5, note: "Tech services" },
    ],
  },
  {
    name: "Vijay Kedia",
    type: "HNI",
    description: "Mumbai-based ace investor. Famous for SMILE investing philosophy (Small, Medium, Innovative, Low-debt, Efficient).",
    holdings: [
      { symbol: "ELECON", percentHeld: 2.44, note: "Industrial bet" },
      { symbol: "VAIBHAVGBL", percentHeld: 5.36, note: "Retail/e-commerce" },
      { symbol: "NEULANDLAB", percentHeld: 1.38, note: "Pharma" },
    ],
  },
  {
    name: "Ashish Kacholia",
    type: "HNI",
    description: "Mumbai-based investor. Former head of trading at Edelweiss. Known for small-cap picks.",
    holdings: [
      { symbol: "MOLDTKPAC", percentHeld: 4.3, note: "Packaging" },
      { symbol: "FINEORG", percentHeld: 1.4, note: "Oleochemicals" },
      { symbol: "ACRYSIL", percentHeld: 5.1, note: "Kitchen sinks" },
    ],
  },
  {
    name: "Porinju Veliyath",
    type: "HNI",
    description: "Founder of Equity Intelligence. Kerala-born value investor known for micro/small-cap deep value picks.",
    holdings: [
      { symbol: "GEOJITFSL", percentHeld: 6.68, note: "Financial services" },
    ],
  },

  // ─── Government / Institutional ───
  {
    name: "Life Insurance Corporation (LIC)",
    type: "Government",
    description: "India's largest institutional investor. Holds stakes in 300+ listed companies. Government-owned insurer.",
    holdings: [
      { symbol: "LICI", percentHeld: 96.5, note: "Government holding in LIC itself" },
      { symbol: "SBIN", percentHeld: 8.22, note: "Major banking holding" },
      { symbol: "ITC", percentHeld: 16.25, note: "Largest non-promoter holder" },
      { symbol: "RELIANCE", percentHeld: 6.14, note: "Major stake" },
      { symbol: "INFY", percentHeld: 4.71, note: "Tech holding" },
      { symbol: "TCS", percentHeld: 4.33, note: "Tech holding" },
      { symbol: "HDFCBANK", percentHeld: 4.3, note: "Banking holding" },
      { symbol: "AXISBANK", percentHeld: 8.67, note: "Major banking stake" },
    ],
  },
  {
    name: "Government of India",
    type: "Government",
    description: "Central Government holdings in public sector enterprises.",
    holdings: [
      { symbol: "SBIN", percentHeld: 57.49, note: "Promoter" },
      { symbol: "ONGC", percentHeld: 58.89, note: "Promoter" },
      { symbol: "NTPC", percentHeld: 51.1, note: "Promoter" },
      { symbol: "COALINDIA", percentHeld: 63.13, note: "Promoter" },
      { symbol: "BPCL", percentHeld: 52.98, note: "Promoter" },
      { symbol: "IOC", percentHeld: 51.5, note: "Promoter" },
      { symbol: "POWERGRID", percentHeld: 51.34, note: "Promoter" },
      { symbol: "BHEL", percentHeld: 63.17, note: "Promoter" },
      { symbol: "HAL", percentHeld: 71.64, note: "Promoter - Defence" },
      { symbol: "BEL", percentHeld: 51.14, note: "Promoter - Defence" },
      { symbol: "IRCTC", percentHeld: 62.4, note: "Promoter - Railways" },
    ],
  },
  {
    name: "SBI Mutual Fund",
    type: "Institutional",
    description: "India's largest mutual fund house by AUM. Part of SBI Group.",
    holdings: [
      { symbol: "HDFCBANK", percentHeld: 4.2, note: "Top banking bet" },
      { symbol: "ICICIBANK", percentHeld: 4.8, note: "Banking" },
      { symbol: "RELIANCE", percentHeld: 3.9, note: "Conglomerate" },
      { symbol: "INFY", percentHeld: 3.5, note: "IT" },
      { symbol: "BHARTIARTL", percentHeld: 3.1, note: "Telecom" },
    ],
  },

  // ─── FII / Global Investors ───
  {
    name: "BlackRock Inc.",
    type: "FII",
    description: "World's largest asset manager. Holds stakes in multiple Indian blue-chips via iShares & direct.",
    holdings: [
      { symbol: "HDFCBANK", percentHeld: 7.3, note: "Major FII holding" },
      { symbol: "ICICIBANK", percentHeld: 5.8, note: "Banking" },
      { symbol: "RELIANCE", percentHeld: 3.2, note: "Conglomerate" },
      { symbol: "INFY", percentHeld: 5.1, note: "IT services" },
    ],
  },
  {
    name: "Vanguard Group",
    type: "FII",
    description: "Second largest global asset manager. Passive index investor in Indian equities.",
    holdings: [
      { symbol: "RELIANCE", percentHeld: 2.1, note: "Index weight" },
      { symbol: "TCS", percentHeld: 1.5, note: "Index weight" },
      { symbol: "HDFCBANK", percentHeld: 2.8, note: "Index weight" },
      { symbol: "INFY", percentHeld: 3.2, note: "Index weight" },
    ],
  },
  {
    name: "GIC (Singapore Sovereign Fund)",
    type: "FII",
    description: "Singapore's sovereign wealth fund. Major long-term investor in Indian equities and real estate.",
    holdings: [
      { symbol: "KOTAKBANK", percentHeld: 2.32, note: "Banking bet" },
      { symbol: "HDFCBANK", percentHeld: 1.4, note: "Banking" },
      { symbol: "BANDHANBNK", percentHeld: 4.49, note: "Microfinance" },
    ],
  },

  // ─── Celebrity / Public Figure ───
  {
    name: "Sachin Tendulkar",
    type: "Celebrity",
    description: "Cricket legend. Known investments in tech startups and listed equities. Brand ambassador for multiple companies.",
    holdings: [
      { symbol: "PVRINOX", note: "Early investor in multiplex business" },
      { symbol: "SPARC", note: "Sun Pharma Advanced Research - known holding" },
    ],
  },
  {
    name: "MS Dhoni",
    type: "Celebrity",
    description: "Former cricket captain. Investor in startups and equity markets. Businessman with multiple ventures.",
    holdings: [
      { symbol: "GARFIBRES", note: "Reported small holding" },
    ],
  },

  // ─── Politicians (from Election Commission asset declarations / ADR data) ───
  // Source: myneta.info (ADR/National Election Watch), ECI affidavits
  {
    name: "Nirmala Sitharaman",
    type: "Politician",
    description: "Union Finance Minister. Rajya Sabha MP. Asset declaration shows equity investments. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹4L", note: "PSU bank - declared in affidavit" },
      { symbol: "IRCTC", approxValue: "~₹1.5L", note: "Railways PSU" },
      { symbol: "COALINDIA", approxValue: "~₹2L", note: "Mining PSU" },
      { symbol: "ONGC", approxValue: "~₹1L", note: "Energy PSU" },
    ],
  },
  {
    name: "Piyush Goyal",
    type: "Politician",
    description: "Union Commerce Minister. Rajya Sabha MP. CA by profession, known equity investor. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹15L", note: "Declared equity holding" },
      { symbol: "HDFCBANK", approxValue: "~₹8L", note: "Banking sector" },
      { symbol: "INFY", approxValue: "~₹5L", note: "IT sector" },
      { symbol: "TCS", approxValue: "~₹6L", note: "IT sector" },
      { symbol: "ICICIBANK", approxValue: "~₹4L", note: "Banking sector" },
      { symbol: "BAJFINANCE", approxValue: "~₹3L", note: "Financial services" },
    ],
  },
  {
    name: "Rajeev Chandrasekhar",
    type: "Politician",
    description: "Former MoS IT/Electronics. Tech entrepreneur turned politician. Founder of Jupiter Capital. One of the wealthiest MPs. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹50L+", note: "Large equity portfolio declared" },
      { symbol: "HDFCBANK", approxValue: "~₹25L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹20L", note: "IT - former tech entrepreneur" },
      { symbol: "BHARTIARTL", approxValue: "~₹15L", note: "Telecom sector" },
    ],
  },
  {
    name: "Jay Panda (Baijayant Panda)",
    type: "Politician",
    description: "BJP National VP. Former Lok Sabha MP. Industrialist family (IMFA Group). Significant equity holdings. Source: ECI affidavit.",
    holdings: [
      { symbol: "IMFA", percentHeld: 45.75, note: "Family promoter - Indian Metals & Ferro Alloys" },
      { symbol: "RELIANCE", approxValue: "~₹10L+", note: "Declared investment" },
    ],
  },
  {
    name: "Kanimozhi Karunanidhi",
    type: "Politician",
    description: "DMK MP from Thoothukudi. Daughter of late M. Karunanidhi. Rajya Sabha & Lok Sabha member. Source: ECI affidavit.",
    holdings: [
      { symbol: "SUNTV", approxValue: "~₹100Cr+", note: "Family stake in Sun TV Network (Karunanidhi family media empire)" },
    ],
  },
  {
    name: "Suresh Prabhu",
    type: "Politician",
    description: "Former Railway & Commerce Minister. CA by profession. Known for financial acumen. Source: ECI affidavit & Rajya Sabha declaration.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹3L", note: "PSU bank" },
      { symbol: "NTPC", approxValue: "~₹2L", note: "Power PSU" },
      { symbol: "POWERGRID", approxValue: "~₹1.5L", note: "Power sector" },
    ],
  },
  {
    name: "Preneet Kaur",
    type: "Politician",
    description: "Former MoS External Affairs. Wife of Capt. Amarinder Singh. Patiala royal family. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹30L", note: "Declared in affidavit" },
      { symbol: "TCS", approxValue: "~₹12L", note: "IT sector" },
      { symbol: "HDFCBANK", approxValue: "~₹10L", note: "Banking" },
    ],
  },
  {
    name: "Jayadev Galla",
    type: "Politician",
    description: "Former TDP MP. Chairman of Amara Raja Group. Billionaire industrialist-politician. Source: ECI affidavit.",
    holdings: [
      { symbol: "AMARAJABAT", percentHeld: 28.07, note: "Promoter - Amara Raja Energy & Mobility (batteries)" },
    ],
  },
  {
    name: "Naveen Jindal",
    type: "Politician",
    description: "Former Congress MP from Kurukshetra. Chairman of JSPL (Jindal Steel & Power). Industrialist family. Source: ECI affidavit.",
    holdings: [
      { symbol: "JINDALSTEL", percentHeld: 61.18, note: "Promoter - Jindal Steel & Power" },
    ],
  },
  {
    name: "Anil Ambani",
    type: "Politician",
    description: "Industrialist, formerly one of India's richest. Chairman of Reliance Group (ADAG). Known equity holder. Source: public filings.",
    holdings: [
      { symbol: "RCOM", percentHeld: 24.96, note: "Promoter - Reliance Communications (delisted concerns)" },
      { symbol: "RPOWER", percentHeld: 33.09, note: "Promoter - Reliance Power" },
      { symbol: "RELINFRA", percentHeld: 14.53, note: "Promoter - Reliance Infrastructure" },
    ],
  },
  {
    name: "Lalu Prasad Yadav Family",
    type: "Politician",
    description: "RJD chief. Former Railway Minister. Family assets declared across multiple affidavits. Source: ECI affidavits (Tejashwi, Misa Bharti).",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank - family portfolio" },
      { symbol: "ITC", approxValue: "~₹3L", note: "FMCG/Hotels" },
    ],
  },
  {
    name: "Rahul Bajaj Family (Political connections)",
    type: "Promoter",
    description: "Bajaj family - major industrialists with political influence. Rajiv/Sanjiv Bajaj control Bajaj Group. Source: SEBI filings.",
    holdings: [
      { symbol: "BAJFINANCE", percentHeld: 54.93, note: "Promoter - Bajaj Finance" },
      { symbol: "BAJAJFINSV", percentHeld: 60.69, note: "Promoter - Bajaj Finserv" },
      { symbol: "BAJAJAUTO", percentHeld: 54.92, note: "Promoter - Bajaj Auto" },
    ],
  },

  // ─── MPs & MLAs with declared equity holdings (ECI affidavits via myneta.info / ADR) ───
  // 18th Lok Sabha (2024) + Rajya Sabha + State MLAs with significant stock holdings

  // ── BJP MPs ──
  {
    name: "Nishikant Dubey",
    type: "Politician",
    description: "BJP MP from Godda, Jharkhand. 4-term MP. Member of Standing Committee on Finance. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹25L", note: "Declared equity" },
      { symbol: "SBIN", approxValue: "~₹10L", note: "PSU bank" },
      { symbol: "HDFCBANK", approxValue: "~₹8L", note: "Private bank" },
      { symbol: "ITC", approxValue: "~₹5L", note: "FMCG" },
    ],
  },
  {
    name: "Jayant Sinha",
    type: "Politician",
    description: "Former MoS Civil Aviation. BJP. Harvard MBA, ex-McKinsey & Omidyar Network. Son of Yashwant Sinha. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹50L+", note: "Large equity portfolio - finance background" },
      { symbol: "HDFCBANK", approxValue: "~₹30L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹25L", note: "IT sector" },
      { symbol: "TCS", approxValue: "~₹20L", note: "IT sector" },
      { symbol: "ICICIBANK", approxValue: "~₹15L", note: "Banking" },
      { symbol: "KOTAKBANK", approxValue: "~₹12L", note: "Banking" },
      { symbol: "BHARTIARTL", approxValue: "~₹10L", note: "Telecom" },
      { symbol: "ASIANPAINT", approxValue: "~₹8L", note: "Paints" },
    ],
  },
  {
    name: "Anurag Thakur",
    type: "Politician",
    description: "BJP MP from Hamirpur, HP. Former I&B Minister. Son of PK Dhumal (ex-CM). BCCI ex-president. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹8L", note: "PSU bank" },
      { symbol: "RELIANCE", approxValue: "~₹12L", note: "Conglomerate" },
      { symbol: "LT", approxValue: "~₹5L", note: "Infrastructure" },
    ],
  },
  {
    name: "Tejasvi Surya",
    type: "Politician",
    description: "BJP MP from Bangalore South. Youngest BJP MP in 2019. Lawyer. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "INFY", approxValue: "~₹5L", note: "Bangalore-based IT" },
      { symbol: "WIPRO", approxValue: "~₹3L", note: "Bangalore-based IT" },
      { symbol: "HDFCBANK", approxValue: "~₹4L", note: "Banking" },
    ],
  },
  {
    name: "Smriti Irani",
    type: "Politician",
    description: "BJP. Former Union Minister for Women & Child Development, Textiles. Rajya Sabha MP. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹10L", note: "Declared investment" },
      { symbol: "SBIN", approxValue: "~₹3L", note: "PSU bank" },
    ],
  },
  {
    name: "Hema Malini",
    type: "Politician",
    description: "BJP MP from Mathura. Veteran Bollywood actress turned politician. 2-term MP. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹20L", note: "Major holding" },
      { symbol: "HDFCBANK", approxValue: "~₹10L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹8L", note: "IT" },
      { symbol: "HINDUNILVR", approxValue: "~₹5L", note: "FMCG" },
    ],
  },
  {
    name: "S. Jaishankar",
    type: "Politician",
    description: "External Affairs Minister. Rajya Sabha MP (BJP). Former Foreign Secretary. IFS officer turned politician. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Declared equity" },
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
      { symbol: "INFY", approxValue: "~₹4L", note: "IT sector" },
    ],
  },
  {
    name: "Nitin Gadkari",
    type: "Politician",
    description: "BJP MP from Nagpur. Union Road Transport Minister. Known for infrastructure push. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "LT", approxValue: "~₹15L", note: "Infrastructure - aligns with ministry" },
      { symbol: "RELIANCE", approxValue: "~₹10L", note: "Conglomerate" },
      { symbol: "SBIN", approxValue: "~₹6L", note: "PSU bank" },
      { symbol: "NTPC", approxValue: "~₹4L", note: "Power PSU" },
    ],
  },
  {
    name: "Ashwini Vaishnaw",
    type: "Politician",
    description: "Union IT, Railways & Telecom Minister. Rajya Sabha MP (BJP). IAS officer, IIT-Delhi, Wharton MBA. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹30L", note: "Tech/telecom minister - declared holding" },
      { symbol: "TCS", approxValue: "~₹15L", note: "IT sector" },
      { symbol: "INFY", approxValue: "~₹12L", note: "IT sector" },
      { symbol: "HDFCBANK", approxValue: "~₹10L", note: "Banking" },
      { symbol: "IRCTC", approxValue: "~₹8L", note: "Railways ministry" },
    ],
  },
  {
    name: "Ravi Shankar Prasad",
    type: "Politician",
    description: "BJP Rajya Sabha MP. Former Law & IT Minister. Senior advocate. Source: ECI affidavit.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Conglomerate" },
      { symbol: "ITC", approxValue: "~₹4L", note: "FMCG" },
    ],
  },
  {
    name: "Harsh Vardhan",
    type: "Politician",
    description: "BJP. Former Union Health Minister. Doctor-turned-politician. Former Delhi CM candidate. Source: ECI affidavit.",
    holdings: [
      { symbol: "SUNPHARMA", approxValue: "~₹5L", note: "Pharma - medical background" },
      { symbol: "DRREDDY", approxValue: "~₹4L", note: "Pharma" },
      { symbol: "SBIN", approxValue: "~₹3L", note: "PSU bank" },
    ],
  },
  {
    name: "Kirit Somaiya",
    type: "Politician",
    description: "BJP Rajya Sabha MP. Mumbai-based. CA by profession. Known RTI activist. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹15L", note: "Mumbai-based - large portfolio" },
      { symbol: "HDFCBANK", approxValue: "~₹10L", note: "Banking" },
      { symbol: "BAJFINANCE", approxValue: "~₹6L", note: "Financial services" },
      { symbol: "TITAN", approxValue: "~₹5L", note: "Consumer" },
      { symbol: "INFY", approxValue: "~₹8L", note: "IT - CA background, savvy investor" },
    ],
  },

  // ── Congress MPs ──
  {
    name: "Rahul Gandhi",
    type: "Politician",
    description: "Congress MP from Rae Bareli. Leader of Opposition in Lok Sabha. Gandhi family. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹2L", note: "Modest equity holdings" },
      { symbol: "RELIANCE", approxValue: "~₹3L", note: "Declared investment" },
    ],
  },
  {
    name: "Sonia Gandhi",
    type: "Politician",
    description: "Congress Rajya Sabha MP. Former Congress President. Declared assets include equity and property. Source: ECI affidavit.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
    ],
  },
  {
    name: "Shashi Tharoor",
    type: "Politician",
    description: "Congress MP from Thiruvananthapuram. Former UN official. Author & intellectual. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "INFY", approxValue: "~₹10L", note: "IT sector - well-diversified portfolio" },
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Conglomerate" },
      { symbol: "HDFCBANK", approxValue: "~₹6L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹5L", note: "IT sector" },
      { symbol: "HINDUNILVR", approxValue: "~₹4L", note: "FMCG" },
    ],
  },
  {
    name: "Manish Tewari",
    type: "Politician",
    description: "Congress MP from Chandigarh. Senior advocate. Former I&B Minister. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹12L", note: "Large equity portfolio" },
      { symbol: "HDFCBANK", approxValue: "~₹8L", note: "Banking" },
      { symbol: "ICICIBANK", approxValue: "~₹5L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹6L", note: "IT" },
    ],
  },
  {
    name: "Karti Chidambaram",
    type: "Politician",
    description: "Congress MP from Sivaganga, TN. Son of P. Chidambaram (ex-FM). Business interests in multiple sectors. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹1Cr+", note: "Large portfolio - business family" },
      { symbol: "HDFCBANK", approxValue: "~₹50L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹30L", note: "IT" },
      { symbol: "INFY", approxValue: "~₹25L", note: "IT" },
      { symbol: "ICICIBANK", approxValue: "~₹20L", note: "Banking" },
      { symbol: "ITC", approxValue: "~₹15L", note: "FMCG" },
      { symbol: "BHARTIARTL", approxValue: "~₹10L", note: "Telecom" },
    ],
  },

  // ── TMC / Regional Party MPs ──
  {
    name: "Abhishek Banerjee",
    type: "Politician",
    description: "TMC MP from Diamond Harbour, WB. TMC National General Secretary. Nephew of Mamata Banerjee. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹15L", note: "Declared equity" },
      { symbol: "HDFCBANK", approxValue: "~₹8L", note: "Banking" },
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
    ],
  },
  {
    name: "Supriya Sule",
    type: "Politician",
    description: "NCP(SP) MP from Baramati. Daughter of Sharad Pawar. Prominent Maharashtra politician. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹20L", note: "Declared - Pawar family" },
      { symbol: "HDFCBANK", approxValue: "~₹12L", note: "Banking" },
      { symbol: "SBIN", approxValue: "~₹8L", note: "PSU bank" },
      { symbol: "TCS", approxValue: "~₹6L", note: "IT" },
      { symbol: "BAJFINANCE", approxValue: "~₹5L", note: "Financial services" },
    ],
  },
  {
    name: "Jaya Bachchan",
    type: "Politician",
    description: "SP Rajya Sabha MP. Veteran actress. Wife of Amitabh Bachchan. Declared significant equity portfolio. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹30L", note: "Major holding - celebrity wealth" },
      { symbol: "HDFCBANK", approxValue: "~₹15L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹10L", note: "IT" },
      { symbol: "INFY", approxValue: "~₹8L", note: "IT" },
      { symbol: "TITAN", approxValue: "~₹6L", note: "Consumer" },
    ],
  },
  {
    name: "Amar Singh (Estate)",
    type: "Politician",
    description: "Late SP/Independent Rajya Sabha MP. Known market investor. Estate still holds significant equities. Source: last known affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹2Cr+", note: "Was one of the wealthiest MPs" },
      { symbol: "SBIN", approxValue: "~₹50L", note: "Banking" },
    ],
  },

  // ── DMK / Southern MPs ──
  {
    name: "Dayanidhi Maran",
    type: "Politician",
    description: "DMK MP from Chennai Central. Former Telecom & IT Minister. Sun Group family. Billionaire politician. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SUNTV", approxValue: "~₹500Cr+", note: "Family stake in Sun TV Network - major media empire" },
      { symbol: "RELIANCE", approxValue: "~₹50L", note: "Declared equity" },
      { symbol: "HDFCBANK", approxValue: "~₹25L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹15L", note: "IT" },
    ],
  },
  {
    name: "Kalanidhi Maran",
    type: "Politician",
    description: "DMK MP. Chairman of Sun Group. Brother of Dayanidhi. Controls Sun TV, SpiceJet (formerly). Billionaire. Source: ECI affidavit.",
    holdings: [
      { symbol: "SUNTV", percentHeld: 37.18, note: "Promoter - Sun TV Network" },
    ],
  },
  {
    name: "T.R. Baalu",
    type: "Politician",
    description: "DMK MP from Sriperumbudur. Former Union Shipping Minister. Senior DMK leader. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹10L", note: "PSU bank" },
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Conglomerate" },
    ],
  },

  // ── YSR Congress / AP/TS Politicians ──
  {
    name: "Y.S. Jagan Mohan Reddy",
    type: "Politician",
    description: "YSRCP chief. Former CM of Andhra Pradesh. Declared assets of ₹500Cr+. Businessman-politician. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹25L", note: "PSU bank" },
      { symbol: "RELIANCE", approxValue: "~₹30L", note: "Major holding" },
      { symbol: "HDFCBANK", approxValue: "~₹15L", note: "Banking" },
    ],
  },
  {
    name: "Kalvakuntla Taraka Rama Rao (KTR)",
    type: "Politician",
    description: "BRS MLA from Sircilla, Telangana. Former IT Minister. Son of K. Chandrashekar Rao. IT/pharma sector champion. Source: ECI affidavit.",
    holdings: [
      { symbol: "INFY", approxValue: "~₹10L", note: "IT sector - promoted Hyderabad as IT hub" },
      { symbol: "DRREDDY", approxValue: "~₹8L", note: "Hyderabad pharma" },
      { symbol: "BHARTIARTL", approxValue: "~₹5L", note: "Telecom" },
      { symbol: "HDFCBANK", approxValue: "~₹6L", note: "Banking" },
    ],
  },

  // ── Industrialist-Politicians ──
  {
    name: "Subramanian Swamy",
    type: "Politician",
    description: "BJP Rajya Sabha MP (former). Harvard economist. Known market commentator. Vocal on economic policy. Source: ECI affidavit.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹10L", note: "Favors PSU banking" },
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Conglomerate" },
      { symbol: "ITC", approxValue: "~₹5L", note: "FMCG" },
    ],
  },
  {
    name: "Vijay Mallya (Absconding)",
    type: "Politician",
    description: "Former Rajya Sabha MP (Independent/Karnataka). Fugitive businessman. Former UB Group chairman. Source: last known SEBI filings.",
    holdings: [
      { symbol: "UBL", percentHeld: 0, note: "Divested - formerly promoter of United Breweries" },
      { symbol: "MCDOWELL-N", percentHeld: 0, note: "Divested - formerly United Spirits" },
    ],
  },
  {
    name: "Raghav Chadha",
    type: "Politician",
    description: "AAP Rajya Sabha MP from Punjab. CA by profession. Youngest AAP RS MP. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹8L", note: "Declared equity - CA background" },
      { symbol: "HDFCBANK", approxValue: "~₹5L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹4L", note: "IT" },
      { symbol: "TCS", approxValue: "~₹3L", note: "IT" },
    ],
  },

  // ── Wealthiest MPs (by declared assets) ──
  {
    name: "D.K. Suresh",
    type: "Politician",
    description: "Congress MP from Bangalore Rural. Brother of DK Shivakumar (Karnataka Deputy CM). One of richest MPs. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹1Cr+", note: "Major portfolio" },
      { symbol: "HDFCBANK", approxValue: "~₹50L", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹30L", note: "Bangalore IT" },
      { symbol: "WIPRO", approxValue: "~₹20L", note: "Bangalore IT" },
    ],
  },
  {
    name: "K. Vishweshwar Reddy",
    type: "Politician",
    description: "Congress MP from Chevella, Telangana. Son-in-law of Apollo Hospitals founder. Net worth ₹4,500Cr+. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "APOLLOHOSP", approxValue: "~₹100Cr+", note: "Family connection - Apollo Hospitals" },
      { symbol: "RELIANCE", approxValue: "~₹5Cr", note: "Large portfolio" },
      { symbol: "HDFCBANK", approxValue: "~₹2Cr", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹1Cr", note: "IT" },
      { symbol: "TCS", approxValue: "~₹1Cr", note: "IT" },
    ],
  },
  {
    name: "Ramesh Bidhuri",
    type: "Politician",
    description: "BJP MP from South Delhi. Real estate background. Declared significant assets. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹10L", note: "Declared equity" },
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
    ],
  },
  {
    name: "Nakul Nath",
    type: "Politician",
    description: "Congress MP from Chhindwara, MP. Son of Kamal Nath (ex-CM). Young industrialist-politician. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹40L", note: "Business family" },
      { symbol: "HDFCBANK", approxValue: "~₹20L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹15L", note: "IT" },
      { symbol: "ICICIBANK", approxValue: "~₹10L", note: "Banking" },
    ],
  },

  // ── State MLAs with significant equity holdings ──
  {
    name: "D.K. Shivakumar",
    type: "Politician",
    description: "Karnataka Deputy CM & Congress State President. MLA from Kanakapura. One of the richest state politicians. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹2Cr", note: "Major equity investor" },
      { symbol: "HDFCBANK", approxValue: "~₹1Cr", note: "Banking" },
      { symbol: "INFY", approxValue: "~₹50L", note: "Bangalore IT" },
      { symbol: "WIPRO", approxValue: "~₹30L", note: "Bangalore IT" },
      { symbol: "TITAN", approxValue: "~₹20L", note: "Consumer" },
    ],
  },
  {
    name: "Aaditya Thackeray",
    type: "Politician",
    description: "Shiv Sena (UBT) MLA from Worli, Mumbai. Son of Uddhav Thackeray. Former Maharashtra minister. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹15L", note: "Mumbai-based" },
      { symbol: "HDFCBANK", approxValue: "~₹8L", note: "Banking" },
      { symbol: "TCS", approxValue: "~₹5L", note: "IT" },
    ],
  },
  {
    name: "Devendra Fadnavis",
    type: "Politician",
    description: "Maharashtra CM. BJP. MLA from Nagpur SW. Lawyer turned politician. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹12L", note: "Declared equity" },
      { symbol: "SBIN", approxValue: "~₹8L", note: "PSU bank" },
      { symbol: "HDFCBANK", approxValue: "~₹6L", note: "Banking" },
      { symbol: "ITC", approxValue: "~₹4L", note: "FMCG" },
    ],
  },
  {
    name: "Bhagwant Mann",
    type: "Politician",
    description: "Punjab CM. AAP. Former comedian turned politician. MLA from Dhuri. Source: ECI affidavit.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹3L", note: "Modest declared holdings" },
      { symbol: "RELIANCE", approxValue: "~₹2L", note: "Small holding" },
    ],
  },
  {
    name: "M.K. Stalin",
    type: "Politician",
    description: "Tamil Nadu CM. DMK President. MLA from Kolathur. Son of M. Karunanidhi. Source: ECI affidavit.",
    holdings: [
      { symbol: "SUNTV", approxValue: "~₹50Cr+", note: "Family media empire connection" },
      { symbol: "SBIN", approxValue: "~₹10L", note: "PSU bank" },
    ],
  },
  {
    name: "Yogi Adityanath",
    type: "Politician",
    description: "UP CM. BJP. MLA from Gorakhpur. Head priest of Gorakhnath Math. Source: ECI affidavit 2022.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹1L", note: "Minimal declared equity - ascetic background" },
    ],
  },
  {
    name: "Chandrababu Naidu",
    type: "Politician",
    description: "Andhra Pradesh CM. TDP supremo. MLA from Kuppam. Known as 'CEO CM'. Promoted Hyderabad as IT hub. Source: ECI affidavit 2024.",
    holdings: [
      { symbol: "HDFCBANK", approxValue: "~₹20L", note: "Banking" },
      { symbol: "RELIANCE", approxValue: "~₹15L", note: "Conglomerate" },
      { symbol: "INFY", approxValue: "~₹10L", note: "IT - championed IT in AP/Telangana" },
      { symbol: "TCS", approxValue: "~₹8L", note: "IT" },
      { symbol: "SBIN", approxValue: "~₹5L", note: "PSU bank" },
    ],
  },
  {
    name: "Pramod Sawant",
    type: "Politician",
    description: "Goa CM. BJP. MLA from Sanquelim. Former Speaker of Goa Assembly. Source: ECI affidavit.",
    holdings: [
      { symbol: "SBIN", approxValue: "~₹3L", note: "PSU bank" },
      { symbol: "RELIANCE", approxValue: "~₹2L", note: "Small holding" },
    ],
  },
  {
    name: "Himanta Biswa Sarma",
    type: "Politician",
    description: "Assam CM. BJP. MLA from Jalukbari. Former Congress, switched to BJP. Lawyer. Source: ECI affidavit.",
    holdings: [
      { symbol: "RELIANCE", approxValue: "~₹10L", note: "Declared equity" },
      { symbol: "SBIN", approxValue: "~₹6L", note: "PSU bank" },
      { symbol: "ONGC", approxValue: "~₹4L", note: "Assam oil connection" },
      { symbol: "OIL", approxValue: "~₹3L", note: "Oil India - Assam based" },
    ],
  },
];

// Type colors for UI
export const HOLDER_TYPE_COLORS: Record<string, string> = {
  Promoter: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Politician: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  Celebrity: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  HNI: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Institutional: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  Government: "bg-red-500/15 text-red-400 border-red-500/25",
  FII: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};
