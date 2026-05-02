/**
 * Shared dataset parsing + descriptive statistics utility.
 * Used by Write Paper, Study Assistant, and STEM Solver backends.
 */

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function skewness(values: number[], mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  const n = values.length;
  const m3 = values.reduce((a, v) => a + ((v - mean) / stdDev) ** 3, 0) / n;
  return m3;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i] - mx, yi = y[i] - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

interface ColAnalysis {
  header: string;
  isNumeric: boolean;
  numericValues?: number[];
  rawValues: string[];
  stats?: string;
}

// ── Per-tool context injected into the AI system prompt ──────────────────────

function buildToolContext(tool: string): string {
  const t = tool.toLowerCase().trim();

  if (t === "r" || t === "rstudio") return `
ANALYSIS TOOL: R / RStudio
The student will replicate or verify this analysis in R/RStudio. When writing Methodology and Results sections:
• Name functions explicitly: t.test(), lm(), aov(), cor.test(), wilcox.test(), chisq.test(), fisher.test(), glm(), summary(), confint()
• Use tidyverse/dplyr terminology for data wrangling (filter(), mutate(), group_by(), summarise())
• Reference ggplot2 for all visualisations: "A scatter plot was constructed using ggplot2 (Wickham, 2016)"
• Format inferential results in R console style: t(df) = X.XX, p = .XXX (or p < .001)
• Report regression coefficients as: β = X.XX, SE = X.XX, t(df) = X.XX, p = .XXX, 95% CI [lo, hi]
• Report ANOVA as: F(df1, df2) = X.XX, p = .XXX, η² = X.XX
• Report Pearson r as: r(df) = .XX, p = .XXX
• If referencing installed packages, name them: psych, car, lme4, emmeans, broom, ggpubr
• Cite R itself: R Core Team (2024). R: A Language and Environment for Statistical Computing. R Foundation for Statistical Computing, Vienna, Austria.
• Any code snippets shown must use valid R syntax`;

  if (t === "python") return `
ANALYSIS TOOL: Python (pandas / scipy / statsmodels / matplotlib / seaborn)
The student will replicate or verify this analysis in Python. When writing Methodology and Results sections:
• Reference pandas for data handling: pd.DataFrame, df.describe(), df.groupby(), df.corr()
• Reference scipy.stats for tests: scipy.stats.ttest_ind(), scipy.stats.pearsonr(), scipy.stats.f_oneway(), scipy.stats.chi2_contingency(), scipy.stats.mannwhitneyu()
• Reference statsmodels for regression: statsmodels.formula.api.ols(), smf.logit(), results.summary()
• Reference sklearn for machine learning contexts: sklearn.linear_model.LinearRegression, train_test_split, cross_val_score
• Reference matplotlib/seaborn for visualisations: "A scatter plot was generated using seaborn (Waskom, 2021)"
• Format results in Python output style: statistic=X.XXXX, pvalue=X.XXXX
• Report regression: coef=X.XX, std err=X.XX, t=X.XX, P>|t|=X.XXX, [0.025, 0.975] CI
• Cite: McKinney, W. (2010). Data structures for statistical computing in Python. Proceedings of the 9th Python in Science Conference.
• Any code snippets shown must use valid Python 3 syntax`;

  if (t === "excel") return `
ANALYSIS TOOL: Microsoft Excel (Data Analysis ToolPak)
The student will replicate or verify this analysis in Microsoft Excel. When writing Methodology and Results sections:
• Reference the Data Analysis ToolPak for inferential stats (t-Test, ANOVA, Regression, Descriptive Statistics, Correlation, Histogram, F-Test)
• Name Excel functions explicitly: AVERAGE(), STDEV.S(), STDEV.P(), MEDIAN(), MODE.SNGL(), CORREL(), VAR.S(), QUARTILE.INC(), PERCENTILE.INC(), TTEST(), CHITEST()
• Reference PivotTables for cross-tabulation and grouping
• Reference Excel charts: Column chart, Bar chart, Scatter chart, Line chart, Box and Whisker, Histogram
• Format results as Excel output labels: "t Stat", "P(T<=t) two-tail", "F", "Significance F", "R Square", "Adjusted R Square", "Standard Error"
• Report regression from Excel Regression output: R²=X.XX, Adjusted R²=X.XX, F(df1,df2)=X.XX, p=X.XXX; Coefficients table with Intercept and slopes
• Note: Excel uses STDEV.S (sample SD) by default — specify if population SD is used
• Any code or formula snippets shown must be valid Excel formula syntax (e.g., =TTEST(A2:A20,B2:B20,2,2))`;

  if (t === "spss") return `
ANALYSIS TOOL: IBM SPSS Statistics
The student will replicate or verify this analysis in IBM SPSS Statistics. When writing Methodology and Results sections:
• Use SPSS menu path descriptions: Analyze → Compare Means → Independent-Samples T Test; Analyze → General Linear Model → Univariate; Analyze → Regression → Linear
• Reference SPSS output table names exactly: "Group Statistics" table, "Independent Samples Test" table, "Model Summary" table, "ANOVA" table, "Coefficients" table, "Descriptive Statistics" table
• Format t-test results as SPSS reports them: t(df) = X.XX, p = .XXX (2-tailed), Cohen's d
• Format ANOVA: F(df1, df2) = X.XX, p = .XXX, partial η² = X.XX
• Format regression: R² = X.XX, adjusted R² = X.XX, F(df1, df2) = X.XX, p = .XXX; β = X.XX (unstandardised B), ß = X.XX (standardised Beta)
• Reference Levene's Test for equality of variances (SPSS runs it automatically)
• Reference post-hoc tests as SPSS names them: Tukey HSD, Bonferroni correction, Scheffé
• Reference SPSS chart types: Bar, Histogram, Scatterplot (Legacy Dialogs or Chart Builder)
• Cite: IBM Corp. (2023). IBM SPSS Statistics for Windows, Version 29.0. IBM Corp.`;

  if (t === "stata") return `
ANALYSIS TOOL: Stata
The student will replicate or verify this analysis in Stata. When writing Methodology and Results sections:
• Reference Stata commands: ttest, regress, anova, oneway, pwcorr, logit, probit, summarize, tabulate, histogram, scatter, tabstat
• Use Stata output labels: "Obs", "Mean", "Std. Dev.", "Min", "Max" from summarize; "Coef.", "Std. Err.", "t", "P>|t|", "[95% Conf. Interval]" from regress
• Report t-test: t(df) = X.XX, p = X.XXX (2-tailed)
• Report regression (regress): R² = X.XX, Adj R² = X.XX, F(df1, df2) = X.XX, p = X.XXX; coefficient table with Coef., Std. Err., t, P>|t|
• Report ANOVA (anova/oneway): F(df1, df2) = X.XX, p = X.XXX; with post-hoc using pwcompare or bonferroni
• Reference robust standard errors where appropriate: regress Y X, robust
• Reference panel data commands where applicable: xtreg, xtset, xtivreg
• Cite: StataCorp. (2023). Stata Statistical Software: Release 18. StataCorp LLC.
• Any do-file code snippets must use valid Stata syntax`;

  if (t === "sas") return `
ANALYSIS TOOL: SAS (Statistical Analysis System)
The student will replicate or verify this analysis in SAS. When writing Methodology and Results sections:
• Reference SAS procedures (PROCs): PROC MEANS, PROC FREQ, PROC TTEST, PROC ANOVA, PROC GLM, PROC REG, PROC CORR, PROC LOGISTIC, PROC UNIVARIATE, PROC SGPLOT, PROC SGSCATTER
• Use SAS output labels: "N", "Mean", "Std Dev", "Minimum", "Maximum" from PROC MEANS; "Parameter Estimate", "Standard Error", "t Value", "Pr > |t|" from PROC REG
• Format t-test results (PROC TTEST): t(df) = X.XX, p = X.XXXX (two-tailed); include Equality of Variances test (Folded F)
• Format regression (PROC REG): R² = X.XXXX, Adj R² = X.XXXX, F(df1,df2) = X.XX, p = X.XXXX
• Format ANOVA (PROC GLM/ANOVA): F Value = X.XX, Pr > F = X.XXXX; include Type I and Type III SS
• Reference ODS (Output Delivery System) for formatted output
• Reference SAS/GRAPH or PROC SGPLOT for visualisations
• Cite: SAS Institute Inc. (2023). SAS/STAT® 15.3 User's Guide. SAS Institute Inc.
• Any SAS code snippets must use valid SAS syntax (DATA step or PROC step)`;

  if (t === "matlab") return `
ANALYSIS TOOL: MATLAB (Statistics and Machine Learning Toolbox)
The student will replicate or verify this analysis in MATLAB. When writing Methodology and Results sections:
• Reference MATLAB functions: mean(), std(), median(), var(), corrcoef(), ttest(), ttest2(), anova1(), anova2(), fitlm(), fitglm(), regress(), histogram(), scatter(), boxplot(), bar()
• Reference Statistics and Machine Learning Toolbox functions: fitlm() for linear regression (returns LinearModel object), ttest2() for two-sample t-test, anova1()/anovan() for ANOVA
• Format ttest2() output: h=X, p=X.XXXX, ci=[lo, hi], stats.tstat=X.XX, stats.df=XX
• Format fitlm() output: Coefficients table with Estimate, SE, tStat, pValue; R²=X.XX, Adjusted R²=X.XX, F-stat=X.XX, p=X.XXXX
• Reference corrcoef() output: R matrix (correlation) and P matrix (p-values)
• Reference MATLAB figure types: figure(), subplot(), xlabel(), ylabel(), title(), legend()
• Note MATLAB uses population std by default (std(x,1)) vs sample std (std(x,0) or std(x))
• Cite: The MathWorks, Inc. (2024). MATLAB (Version R2024a). The MathWorks, Inc.
• Any code snippets must use valid MATLAB syntax`;

  if (t === "minitab") return `
ANALYSIS TOOL: Minitab
The student will replicate or verify this analysis in Minitab. When writing Methodology and Results sections:
• Reference Minitab menu paths: Stat → Basic Statistics → 2-Sample t; Stat → ANOVA → One-Way; Stat → Regression → Regression → Fit Regression Model; Stat → Basic Statistics → Correlation
• Use Minitab output labels: "SE Mean", "StDev", "N" from descriptive stats; "T-Value", "P-Value", "DF" from t-tests; "S", "R-sq", "R-sq(adj)", "R-sq(pred)" from regression; "F-Value", "P-Value" from ANOVA
• Format t-test: T(df) = X.XX, p = X.XXX; include 95% CI for the difference
• Format regression: S = X.XX, R² = XX.XX%, Adj R² = XX.XX%; Coefficients table with Coef, SE Coef, T-Value, P-Value, VIF
• Format ANOVA: F(df1, df2) = X.XX, p = X.XXX; include Tukey or Fisher post-hoc if applicable
• Reference Minitab's built-in normality tests: Anderson-Darling, Ryan-Joiner
• Reference Minitab graph types: Dotplot, Histogram, Boxplot, Scatterplot, Interval Plot, Main Effects Plot, Interaction Plot
• Cite: Minitab, LLC. (2024). Minitab Statistical Software (Version 22). Minitab, LLC.`;

  if (t === "prism") return `
ANALYSIS TOOL: GraphPad Prism
The student will replicate or verify this analysis in GraphPad Prism. When writing Methodology and Results sections:
• Reference Prism's analysis wizard: Column → t-test or Mann-Whitney; Column → One-way ANOVA; XY → Correlation and Regression; Grouped → Two-way ANOVA
• Use Prism output labels: "Mean ± SD", "Mean ± SEM", "95% CI", "n", "p value", "t", "df", "R squared"
• Format t-test results as Prism reports: t(df) = X.XX, p = X.XXXX (two-tailed); state if Welch's correction applied
• Format one-way ANOVA: F(DFn, DFd) = X.XX, p = X.XXXX; with post-hoc test (Tukey's multiple comparison test, Dunnett's test)
• Format two-way ANOVA: report interaction F and p, as well as row and column effects
• Format regression: R² = X.XXXX, p = X.XXXX; slope with 95% CI; goodness of fit (sum of squares)
• Format Mann-Whitney U test: U = X, p = X.XXXX (two-tailed)
• Reference nonparametric alternatives Prism offers: Mann-Whitney, Kruskal-Wallis, Wilcoxon matched-pairs signed rank test
• Reference Prism graph styles: XY scatter with error bars (mean ± SEM or SD), bar graph, survival curve, box-and-whisker (Tukey)
• Cite: GraphPad Software, LLC. (2024). GraphPad Prism (Version 10). GraphPad Software, LLC.`;

  if (t === "jamovi") return `
ANALYSIS TOOL: Jamovi
The student will replicate or verify this analysis in jamovi. When writing Methodology and Results sections:
• Reference jamovi's analysis menus: T-Tests → Independent Samples T-Test; ANOVA → One-Way ANOVA; Regression → Linear Regression; Frequencies → Contingency Tables; Factor → Reliability Analysis
• Note that jamovi is built on R — all analyses use underlying R packages (jmv, BayesFactor)
• Use jamovi output table labels: "Statistic", "df", "p" for t-tests; "F", "df1", "df2", "p" for ANOVA; "R²", "Adjusted R²" for regression
• Format t-test: t(df) = X.XX, p = X.XXX; include Cohen's d (jamovi computes it automatically)
• Format one-way ANOVA: F(df1, df2) = X.XX, p = X.XXX, η² = X.XX; with post-hoc Tukey or Games-Howell
• Format regression: R² = X.XX, Adj R² = X.XX, F(df1, df2) = X.XX, p = X.XXX; coefficient table with Estimate, SE, t, p
• Reference jamovi's descriptives: mean, median, SD, SE, IQR, skewness, kurtosis, Shapiro-Wilk test for normality
• Reference jamovi plots: Box plot, Violin, Bar, Scatterplot, Q-Q plot (from within analyses)
• Cite: The jamovi project. (2024). jamovi (Version 2.5). Retrieved from https://www.jamovi.org`;

  if (t === "jasp") return `
ANALYSIS TOOL: JASP (Jeffreys's Amazing Statistics Program)
The student will replicate or verify this analysis in JASP. When writing Methodology and Results sections:
• JASP specialises in Bayesian statistics alongside classical/frequentist — always report both where available
• Reference JASP analyses: T-Tests → Independent Samples T-Test (with Bayesian counterpart); ANOVA → ANOVA (with Bayesian ANOVA); Regression → Linear Regression; Frequencies → Binomial Test; Factor → Reliability
• Report Bayes Factors: BF₁₀ = X.XX (evidence for H₁ vs H₀); interpret per Jeffreys scale (BF > 10 = strong evidence, BF > 3 = moderate, BF < 1 = evidence for H₀)
• Format frequentist t-test: t(df) = X.XX, p = X.XXX, Cohen's d = X.XX, 95% CI [lo, hi]
• Format Bayesian t-test: BF₁₀ = X.XX, δ = X.XX, 95% credible interval [lo, hi]
• Format frequentist ANOVA: F(df1, df2) = X.XX, p = X.XXX, η² = X.XX
• Format Bayesian ANOVA: BFₘ₀ = X.XX (model vs null)
• Reference JASP's sequential analysis and robustness checks
• Reference JASP's prior sensitivity analysis (wide, ultrawide, medium Cauchy priors)
• Cite: JASP Team. (2024). JASP (Version 0.18). Retrieved from https://jasp-stats.org`;

  if (t === "tableau") return `
ANALYSIS TOOL: Tableau
The student will replicate or verify this analysis in Tableau. When writing Methodology and Results sections:
• Tableau is primarily a data visualisation tool — focus on describing visual analytics, dashboards, and Tableau's built-in summary statistics
• Reference Tableau chart types: Bar chart, Line chart, Scatter plot, Heat map, Tree map, Box-and-Whisker plot, Bullet graph, Gantt chart, Map, Density chart
• Reference Tableau features: Filters, Groups, Sets, Calculated Fields, Table Calculations (WINDOW_AVG, WINDOW_SUM, RUNNING_SUM), Level of Detail (LOD) expressions {FIXED, INCLUDE, EXCLUDE}
• Reference Tableau's built-in statistics: Trend lines (linear, polynomial, exponential, logarithmic, power) with R², p-value, and equation; Reference lines, bands, distributions
• Report Tableau trend line output: R² = X.XX, F(df1, df2) = X.XX, p = X.XXX; coefficient estimates
• Reference Tableau Prep for data cleaning and reshaping
• Reference Tableau's clustering (K-means) and forecasting (exponential smoothing) analytics
• Describe visualisations with specific Tableau terminology: Marks card, Rows/Columns shelf, Measure Values, Dimension
• Cite: Tableau Software, LLC. (2024). Tableau Desktop (Version 2024.x). Salesforce.`;

  if (t === "powerbi") return `
ANALYSIS TOOL: Microsoft Power BI
The student will replicate or verify this analysis in Microsoft Power BI. When writing Methodology and Results sections:
• Power BI is a business intelligence and visualisation platform — emphasise interactive dashboards, DAX measures, and visual analytics
• Reference Power BI visual types: Clustered Bar/Column Chart, Line Chart, Scatter Chart, Matrix, Table, Card, KPI, Waterfall Chart, Box Plot, Histogram (custom visual), Decomposition Tree
• Reference DAX (Data Analysis Expressions) for calculated measures: SUM(), AVERAGE(), CALCULATE(), FILTER(), DIVIDE(), DISTINCTCOUNT(), DATEADD(), SAMEPERIODLASTYEAR(), RANKX()
• Reference Power Query (M language) for data transformation: Table.TransformColumnTypes, Table.AddColumn, Table.UnpivotOtherColumns
• Reference Power BI statistics: Quick Insights, Smart Narrative, Anomaly Detection (automated AI features)
• Reference R/Python visual integration in Power BI when statistical tests are needed
• Report descriptive statistics as they appear in Power BI visuals: tooltips showing Sum, Average, Min, Max, Count, % of Total
• Reference slicers and cross-filtering for interactive analysis
• Cite: Microsoft Corporation. (2024). Microsoft Power BI Desktop (Version 2.x). Microsoft Corporation.`;

  if (t === "julia") return `
ANALYSIS TOOL: Julia (Statistics / DataFrames / GLM / Plots)
The student will replicate or verify this analysis in Julia. When writing Methodology and Results sections:
• Reference Julia packages: DataFrames.jl (DataFrame, describe(), combine(), groupby()), Statistics (mean, std, median, var, cor), StatsBase (summarystats, percentile, skewness, kurtosis), HypothesisTests (OneSampleTTest, EqualVarianceTTest, UnequalVarianceTTest, KruskalWallisTest, CorrelationTest), GLM (lm(), glm(), @formula), Plots.jl / StatsPlots.jl / Makie.jl for visualisations
• Format t-test results (HypothesisTests): test statistic=X.XXXX, df=XX, p-value=X.XXXX, 95% CI [lo, hi]
• Format GLM regression (lm()): Coef. table with Coef., Std. Error, t, Pr(>|t|); R²=X.XX, Adj. R²=X.XX, F-stat=X.XX, p=X.XXX
• Reference @formula macro for model specification: lm(@formula(Y ~ X₁ + X₂), df)
• Reference Plots.jl/StatsPlots.jl for graphs: scatter(), histogram(), boxplot(), violin(), corrplot()
• Cite: Bezanson, J., Edelman, A., Karpinski, S., & Shah, V. B. (2017). Julia: A fresh approach to numerical computing. SIAM Review, 59(1), 65–98.
• Any code snippets must use valid Julia syntax`;

  // Default — generic (no specific tool chosen)
  return `
ANALYSIS TOOL: Not specified — use generic academic statistical reporting conventions.
Report statistics using standard APA 7th edition format:
• t(df) = X.XX, p = .XXX for t-tests
• F(df1, df2) = X.XX, p = .XXX, η² = X.XX for ANOVA
• r(df) = .XX, p = .XXX for correlations
• R² = X.XX for regression
• Describe visualisations generically without referencing a specific software package`;
}

export function parseAndAnalyzeDataset(csvText: string, analysisTool?: string): string {
  const lines = csvText.trim().split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return "";

  const firstLine = lines[0];
  const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
  const parseRow = (line: string) => line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  const totalRows = rows.length;

  const columns: ColAnalysis[] = [];
  const colStats: string[] = [];
  const numericCols: { header: string; values: number[] }[] = [];

  headers.forEach((header, colIdx) => {
    const rawValues = rows.map(r => r[colIdx] ?? "").filter(v => v.length > 0);
    const numericValues = rawValues.map(v => parseFloat(v.replace(/,/g, ""))).filter(v => !isNaN(v));

    if (numericValues.length >= rawValues.length * 0.7 && numericValues.length >= 3) {
      const n = numericValues.length;
      const mean = numericValues.reduce((a, b) => a + b, 0) / n;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
      const variance = numericValues.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      const q1 = percentile(sorted, 25);
      const q3 = percentile(sorted, 75);
      const iqr = q3 - q1;
      const skew = skewness(numericValues, mean, stdDev);

      const statLine = `**${header}** (numeric, n=${n}): mean=${mean.toFixed(3)}, median=${median.toFixed(3)}, SD=${stdDev.toFixed(3)}, min=${sorted[0]}, Q1=${q1.toFixed(2)}, Q3=${q3.toFixed(2)}, IQR=${iqr.toFixed(2)}, max=${sorted[n - 1]}, skewness=${skew.toFixed(3)}`;
      colStats.push(statLine);
      numericCols.push({ header, values: numericValues });
      columns.push({ header, isNumeric: true, numericValues, rawValues, stats: statLine });
    } else {
      const counts: Record<string, number> = {};
      rawValues.forEach(v => { counts[v] = (counts[v] ?? 0) + 1; });
      const topCats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const uniqueCount = Object.keys(counts).length;
      const statLine = `**${header}** (categorical, n=${rawValues.length}, ${uniqueCount} unique): ${topCats.map(([v, c]) => `${v}=${c}`).join(", ")}${uniqueCount > 8 ? ` … and ${uniqueCount - 8} more` : ""}`;
      colStats.push(statLine);
      columns.push({ header, isNumeric: false, rawValues, stats: statLine });
    }
  });

  const correlations: string[] = [];
  if (numericCols.length >= 2) {
    const pairs: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const r = pearsonCorrelation(numericCols[i].values, numericCols[j].values);
        pairs.push({ a: numericCols[i].header, b: numericCols[j].header, r });
      }
    }
    pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const notable = pairs.filter(p => Math.abs(p.r) >= 0.3).slice(0, 6);
    if (notable.length > 0) {
      correlations.push("Correlations (Pearson r, notable |r| ≥ 0.3):");
      for (const p of notable) {
        const strength = Math.abs(p.r) >= 0.7 ? "strong" : Math.abs(p.r) >= 0.5 ? "moderate" : "weak";
        const dir = p.r > 0 ? "positive" : "negative";
        correlations.push(`  ${p.a} × ${p.b}: r=${p.r.toFixed(3)} (${strength} ${dir})`);
      }
    }
  }

  const vizSuggestions: string[] = [];
  if (numericCols.length >= 2) {
    vizSuggestions.push(`Scatter plot: ${numericCols[0].header} vs ${numericCols[1].header}`);
  }
  if (numericCols.length >= 1) {
    vizSuggestions.push(`Bar chart / histogram: distribution of ${numericCols[0].header}`);
  }
  const catCol = columns.find(c => !c.isNumeric);
  if (catCol && numericCols.length >= 1) {
    vizSuggestions.push(`Grouped bar chart: ${numericCols[0].header} by ${catCol.header}`);
  }
  if (numericCols.length >= 3) {
    vizSuggestions.push(`Summary table: descriptive statistics for all numeric variables`);
  }

  const financialKeywords = /revenue|profit|loss|assets?|liabilities|equity|ebitda|eps|roe|roa|margin|cash\s*flow|income|expense|dividend|debt|capital|interest|depreciation|amortization|inventory|receivable|payable|balance\s*sheet|net\s*worth|gross|operating|retained|earnings|turnover/i;
  const allHeaders = headers.join(" ");
  const isFinancialData = financialKeywords.test(allHeaders);

  let financialAnalysis = "";
  if (isFinancialData) {
    const financialMetrics: string[] = [];

    const findCol = (pattern: RegExp) => numericCols.find(c => pattern.test(c.header));
    const revenue = findCol(/revenue|sales|turnover|income/i);
    const costOrExp = findCol(/cost|expense|cogs/i);
    const netIncome = findCol(/net\s*(income|profit|earnings)/i);
    const totalAssets = findCol(/total\s*assets/i);
    const totalEquity = findCol(/(total\s*)?equity|net\s*worth|shareholder/i);
    const totalLiab = findCol(/(total\s*)?liabilities|debt/i);

    if (revenue && costOrExp) {
      const revVals = revenue.values;
      const costVals = costOrExp.values;
      const margins = revVals.map((r, i) => i < costVals.length && r !== 0 ? ((r - costVals[i]) / r * 100) : NaN).filter(v => !isNaN(v));
      if (margins.length > 0) {
        const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
        financialMetrics.push(`Gross Margin (avg): ${avgMargin.toFixed(2)}%`);
      }
    }
    if (revenue && netIncome) {
      const revVals = revenue.values;
      const niVals = netIncome.values;
      const npmMargins = revVals.map((r, i) => i < niVals.length && r !== 0 ? (niVals[i] / r * 100) : NaN).filter(v => !isNaN(v));
      if (npmMargins.length > 0) {
        const avgNPM = npmMargins.reduce((a, b) => a + b, 0) / npmMargins.length;
        financialMetrics.push(`Net Profit Margin (avg): ${avgNPM.toFixed(2)}%`);
      }
    }
    if (netIncome && totalAssets) {
      const niVals = netIncome.values;
      const taVals = totalAssets.values;
      const roas = taVals.map((ta, i) => i < niVals.length && ta !== 0 ? (niVals[i] / ta * 100) : NaN).filter(v => !isNaN(v));
      if (roas.length > 0) {
        financialMetrics.push(`Return on Assets (avg): ${(roas.reduce((a, b) => a + b, 0) / roas.length).toFixed(2)}%`);
      }
    }
    if (netIncome && totalEquity) {
      const niVals = netIncome.values;
      const eqVals = totalEquity.values;
      const roes = eqVals.map((eq, i) => i < niVals.length && eq !== 0 ? (niVals[i] / eq * 100) : NaN).filter(v => !isNaN(v));
      if (roes.length > 0) {
        financialMetrics.push(`Return on Equity (avg): ${(roes.reduce((a, b) => a + b, 0) / roes.length).toFixed(2)}%`);
      }
    }
    if (totalLiab && totalEquity) {
      const lVals = totalLiab.values;
      const eVals = totalEquity.values;
      const deRatios = eVals.map((eq, i) => i < lVals.length && eq !== 0 ? (lVals[i] / eq) : NaN).filter(v => !isNaN(v));
      if (deRatios.length > 0) {
        financialMetrics.push(`Debt-to-Equity Ratio (avg): ${(deRatios.reduce((a, b) => a + b, 0) / deRatios.length).toFixed(2)}`);
      }
    }
    if (totalLiab && totalAssets) {
      const lVals = totalLiab.values;
      const aVals = totalAssets.values;
      const daRatios = aVals.map((a, i) => i < lVals.length && a !== 0 ? (lVals[i] / a) : NaN).filter(v => !isNaN(v));
      if (daRatios.length > 0) {
        financialMetrics.push(`Debt-to-Assets Ratio (avg): ${(daRatios.reduce((a, b) => a + b, 0) / daRatios.length).toFixed(2)}`);
      }
    }

    if (revenue && revenue.values.length >= 2) {
      const vals = revenue.values;
      const growthRates: number[] = [];
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] !== 0) growthRates.push(((vals[i] - vals[i - 1]) / Math.abs(vals[i - 1])) * 100);
      }
      if (growthRates.length > 0) {
        financialMetrics.push(`Revenue Growth (period-over-period): ${growthRates.map(g => `${g.toFixed(1)}%`).join(", ")}`);
      }
    }

    if (financialMetrics.length > 0) {
      financialAnalysis = `\nFinancial Ratios & Metrics (computed from your data):\n${financialMetrics.join("\n")}\n`;
    }

    vizSuggestions.push("Waterfall chart: revenue to net income breakdown");
    vizSuggestions.push("Multi-period bar chart: key financial metrics over time");
    if (totalLiab && totalEquity) vizSuggestions.push("Stacked bar chart: capital structure (debt vs equity)");
  }

  const previewRows = rows.slice(0, 5);
  const tableHeader = `| ${headers.join(" | ")} |`;
  const tableSep = `| ${headers.map(() => "---").join(" | ")} |`;
  const tableBody = previewRows.map(r => `| ${headers.map((_, i) => r[i] ?? "").join(" | ")} |`).join("\n");

  const toolContext = buildToolContext(analysisTool ?? "");

  return `STUDENT-PROVIDED DATASET (${totalRows} rows × ${headers.length} columns)
Variables: ${headers.join(", ")}

Data Preview (first ${Math.min(5, totalRows)} rows):
${tableHeader}
${tableSep}
${tableBody}

Descriptive Statistics:
${colStats.join("\n")}
${correlations.length > 0 ? "\n" + correlations.join("\n") : ""}${financialAnalysis}

Suggested Visualisations (describe these in the paper using the actual data values):
${vizSuggestions.map((v, i) => `${i + 1}. ${v}`).join("\n")}
${toolContext}

MANDATORY DATA USAGE RULES:
1. Present and discuss the ACTUAL statistics above — never invent alternative numbers
2. Include at least one properly formatted markdown table showing key statistics
3. Reference specific values (means, SD, ranges, correlations) with precision
4. Interpret what the specific results mean in context of the question or subject
5. Report trends, patterns, or notable distributions observed in the data
6. Describe at least one visualisation (chart/graph) in text — explain what it shows using the real data values
7. If correlations are provided, discuss their strength, direction, and practical significance
8. Use quartiles and IQR to discuss data spread and identify potential outliers
9. FOLLOW THE ANALYSIS TOOL CONVENTIONS ABOVE — use the exact function names, output labels, and reporting format for the specified tool so the student can reproduce the analysis${isFinancialData ? `
10. Present ALL computed financial ratios and interpret them against industry benchmarks
11. Calculate and discuss year-over-year or period-over-period growth rates
12. Perform horizontal (trend) and vertical (common-size) analysis where applicable
13. Discuss financial health, solvency, liquidity, and profitability based on the ratios` : ""}`;
}
