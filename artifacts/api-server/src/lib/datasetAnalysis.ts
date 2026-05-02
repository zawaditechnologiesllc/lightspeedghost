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

// ── Per-test mandatory instructions injected into AI prompt ──────────────────

const TEST_INSTRUCTIONS: Record<string, string> = {
  ttest_ind:
    "MANDATORY TEST — Independent Samples t-test: Compare the means of two independent groups. Report: group means ± SD, Levene's test for equality of variances (F, p), t-statistic, degrees of freedom, two-tailed p-value, Cohen's d, and 95% CI for the mean difference. State clearly whether variances are assumed equal or not.",
  ttest_paired:
    "MANDATORY TEST — Paired Samples t-test: Compare two related measurements (before/after, matched pairs). Report: mean difference ± SD, t-statistic, degrees of freedom, two-tailed p-value, Cohen's d (= mean diff / SD of differences), and 95% CI for the mean difference.",
  oneway_anova:
    "MANDATORY TEST — One-way ANOVA: Test whether means differ across 3+ groups. Report: F(df_between, df_within), p-value, η² (eta-squared) as effect size. Include a descriptives table (n, mean, SD per group). If significant (p < .05), report a post-hoc test (Tukey HSD preferred; note if Bonferroni or Games-Howell used instead).",
  twoway_anova:
    "MANDATORY TEST — Two-way ANOVA: Test main effects of two factors and their interaction. Report each main effect: F(df_effect, df_error), p, partial η². Report the interaction: F(df_interaction, df_error), p, partial η². Describe what a significant interaction means in context.",
  manova:
    "MANDATORY TEST — MANOVA: Test mean differences across groups on multiple dependent variables simultaneously. Report: Wilks' Λ (Lambda), F approximation, df, p-value, partial η². Follow with univariate ANOVAs for each DV. Report Box's M test for homogeneity of covariance matrices.",
  repeated_anova:
    "MANDATORY TEST — Repeated Measures ANOVA: Analyse within-subject changes over time/conditions. Report: Mauchly's test of sphericity (W, p); if violated, apply Greenhouse-Geisser correction (ε). Report F(df_corrected), p, partial η². Include post-hoc pairwise comparisons with Bonferroni correction.",
  mann_whitney:
    "MANDATORY TEST — Mann-Whitney U test (non-parametric): Use instead of independent t-test when normality is violated. Report: U statistic, z-score, two-tailed p-value, effect size r (= z / √N). Report median and IQR for each group instead of mean ± SD.",
  wilcoxon:
    "MANDATORY TEST — Wilcoxon Signed-Rank Test (non-parametric): Use instead of paired t-test when normality is violated. Report: W (or T) statistic, z-score, two-tailed p-value, effect size r (= z / √N). Report median difference and IQR.",
  kruskal_wallis:
    "MANDATORY TEST — Kruskal-Wallis H Test (non-parametric): Use instead of one-way ANOVA when normality is violated or data is ordinal. Report: H statistic, df, p-value, effect size η² (= (H − k + 1) / (N − k)). Report median and IQR per group. If significant, report post-hoc Dunn's test with Bonferroni correction.",
  friedman:
    "MANDATORY TEST — Friedman Test (non-parametric): Non-parametric alternative to repeated measures ANOVA. Report: χ²(df) = X.XX, p-value, Kendall's W as effect size. Report median rankings per condition. Follow with post-hoc Wilcoxon signed-rank tests if significant.",
  pearson:
    "MANDATORY TEST — Pearson Correlation: Test linear relationship between two continuous variables. Report: r(df) = X.XX, p = .XXX (two-tailed), R² = X.XX (variance explained), 95% CI for r. Characterise strength: |r| < .20 negligible, .20–.39 weak, .40–.59 moderate, .60–.79 strong, ≥ .80 very strong. Include a correlation matrix if there are 3+ numeric variables.",
  spearman:
    "MANDATORY TEST — Spearman Rank Correlation: Non-parametric alternative for ordinal data or when Pearson assumptions are violated. Report: rs(df) = X.XX, p = .XXX (two-tailed). Characterise strength using the same benchmarks as Pearson r. Note that Spearman measures monotonic (not necessarily linear) relationships.",
  chi_square:
    "MANDATORY TEST — Chi-Square Test of Independence: Test association between two categorical variables. Report: χ²(df) = X.XX, N = XX, p = .XXX, Cramér's V as effect size (V = √(χ²/N·min(r−1,c−1))). Include an observed frequency table and expected frequency table. Check assumptions: no cell with expected frequency < 5; if violated, use Fisher's exact test.",
  fishers_exact:
    "MANDATORY TEST — Fisher's Exact Test: Use for 2×2 tables where expected cell frequencies < 5. Report: exact two-tailed p-value, odds ratio (OR) with 95% CI. Describe the direction and magnitude of the association.",
  point_biserial:
    "MANDATORY TEST — Point-Biserial Correlation: Correlation between a dichotomous variable and a continuous variable. Report: rpb = X.XX, p = .XXX, R² = X.XX. Note: numerically equivalent to Pearson r when one variable is binary (0/1).",
  cramers_v:
    "MANDATORY TEST — Cramér's V: Report as effect size for chi-square tests. V = √(χ²/N·min(r−1,c−1)). Interpret: V ≈ .10 small, ≈ .30 medium, ≈ .50 large (for df = 1). Adjust benchmarks for larger tables.",
  simple_regression:
    "MANDATORY TEST — Simple Linear Regression: Predict one continuous outcome from one predictor. Report: regression equation (Ŷ = b₀ + b₁X), unstandardised coefficients (B) with SE and 95% CI, standardised coefficient (β), t, p, R², Adjusted R², F(1, N−2), p for the model. Assess assumptions: linearity, homoscedasticity, normality of residuals.",
  multiple_regression:
    "MANDATORY TEST — Multiple Linear Regression: Predict outcome from two or more predictors. Report: overall model F(df1, df2), p, R², Adjusted R². For each predictor: B, SE, β, t, p, 95% CI for B, VIF (multicollinearity check; VIF > 10 is problematic). Identify which predictors are significant. Report the full regression equation.",
  logistic_regression:
    "MANDATORY TEST — Binary Logistic Regression: Predict a binary outcome. Report: −2 Log Likelihood, Nagelkerke R², Hosmer-Lemeshow goodness-of-fit (χ², p). For each predictor: B, SE, Wald statistic, p, Exp(B) = odds ratio with 95% CI. Report classification table (overall accuracy %). Interpret each significant OR in plain language.",
  polynomial_regression:
    "MANDATORY TEST — Polynomial Regression: Fit a curvilinear relationship. Report: the polynomial model equation, R², Adjusted R², F-statistic, p. Report each term's B, SE, t, p. Compare R² improvement over simple linear model using F-change test to justify the polynomial term.",
  hierarchical_regression:
    "MANDATORY TEST — Hierarchical (Blocked) Regression: Enter predictors in theoretically motivated steps. For each block/step, report: R², Adjusted R², R² Change (ΔR²), F Change, p for ΔR². Report final model's full coefficient table. Discuss what each block adds above and beyond the previous block.",
  descriptives:
    "MANDATORY TEST — Full Descriptive Statistics Table: Present a complete descriptive statistics table with the following for every numeric variable: N, Mean, SD, SE, Median, Mode (if applicable), Minimum, Maximum, Range, Q1, Q3, IQR, Skewness, Kurtosis. Use a properly formatted markdown table. Discuss the shape, central tendency, and spread of each variable.",
  normality:
    "MANDATORY TEST — Normality Testing: Test whether each numeric variable follows a normal distribution. Report Shapiro-Wilk test (preferred for N < 50) or Kolmogorov-Smirnov test (N ≥ 50): W (or D) statistic, p-value for each variable. Also report skewness and kurtosis: values between −2 and +2 are generally acceptable for normality. State whether normality is supported or violated for each variable, and what this implies for the choice of parametric vs non-parametric tests.",
  frequency:
    "MANDATORY TEST — Frequency Analysis: For all categorical variables, produce a complete frequency table showing: category labels, frequency (n), valid percent, cumulative percent. Discuss the most common category, distribution of responses, and any notable patterns or imbalances.",
  effect_size:
    "MANDATORY TEST — Effect Sizes: Compute and report effect sizes for all inferential tests in the paper. Use: Cohen's d for t-tests (small = .20, medium = .50, large = .80), η² or partial η² for ANOVA (small = .01, medium = .06, large = .14), r for non-parametric tests (small = .10, medium = .30, large = .50), R² for regression (small = .02, medium = .13, large = .26), Cramér's V for chi-square. Interpret each effect size verbally in the Results section.",
  confidence_intervals:
    "MANDATORY TEST — Confidence Intervals: Report 95% confidence intervals for all key estimates in the paper: means (mean ± 1.96·SE), mean differences, regression coefficients (B ± 1.96·SE), correlations (use Fisher's z-transformation), odds ratios (log scale). Present CIs alongside p-values for every inferential result. If CIs do not cross zero (or 1 for ORs), the result is statistically significant.",
  pca:
    "MANDATORY TEST — Principal Component Analysis (PCA): Report: Kaiser-Meyer-Olkin (KMO) measure of sampling adequacy (>.60 acceptable), Bartlett's test of sphericity (χ², df, p). Extract components using eigenvalue > 1 criterion (Kaiser rule) OR based on scree plot. Report: eigenvalues, percentage of variance explained, cumulative variance. Present a rotated component matrix (Varimax rotation preferred). Interpret each component by the variables that load most strongly (|loading| > .40).",
  factor_analysis:
    "MANDATORY TEST — Exploratory Factor Analysis (EFA): Report: KMO, Bartlett's test. Specify extraction method (Maximum Likelihood or Principal Axis Factoring) and rotation (Oblimin for correlated factors, Varimax for orthogonal). Report factor loadings matrix (only loadings |.30|+), communalities (h²), eigenvalues, and cumulative variance explained. Name each factor based on its strongest loadings. Report Cronbach's α for each factor's items as reliability estimate.",
  cluster_kmeans:
    "MANDATORY TEST — K-means Cluster Analysis: Report the number of clusters (k) chosen and the method used to determine k (elbow method, silhouette score, or theoretical). Report: cluster sizes (n per cluster), cluster centroids for each variable, within-cluster sum of squares, between-cluster sum of squares, total sum of squares. Describe and name each cluster profile based on centroid values. Note that k-means uses Euclidean distance and requires standardised variables.",
  reliability:
    "MANDATORY TEST — Reliability Analysis (Cronbach's α): Report Cronbach's alpha for the full scale: α = X.XX. Interpret: α ≥ .90 excellent, .80–.89 good, .70–.79 acceptable, .60–.69 questionable, < .60 poor (Nunnally, 1978). Report item-total correlations and 'α if item deleted' for each item. Flag any item that substantially lowers α if removed.",
  time_series:
    "MANDATORY TEST — Time Series Analysis: Identify the temporal variable and the outcome variable. Report: trend direction (upward/downward/stable), seasonal patterns if present, autocorrelation (Durbin-Watson statistic for regression residuals: values near 2 indicate no autocorrelation). Compute and report period-over-period changes (absolute and percentage). If appropriate, fit a linear trend line and report slope, R², and p-value. Discuss stationarity.",
  survival:
    "MANDATORY TEST — Survival Analysis (Kaplan-Meier): Report: number of events and censored observations. For each group, report median survival time with 95% CI. Report Log-rank test (Mantel-Cox): χ²(df), p-value. Interpret as probability of event-free survival at key time points. If comparing groups, report hazard ratio (HR) with 95% CI from Cox proportional hazards model.",
  mediation:
    "MANDATORY TEST — Mediation Analysis: Test whether the effect of X on Y operates through mediator M. Report all four paths: total effect (c: X→Y), direct effect (c': X→Y controlling for M), a path (X→M), b path (M→Y controlling for X). Compute indirect effect (a×b) with 95% bootstrap CI (5,000 resamples; PROCESS macro / lavaan / mediation package). If 95% CI for indirect effect excludes zero, mediation is supported. Report full vs partial mediation distinction. Include path diagram description.",
  moderation:
    "MANDATORY TEST — Moderation / Interaction Analysis: Test whether the relationship between X and Y depends on moderator variable W. Standardise (mean-centre) X and W before computing the interaction term X×W. Report: regression coefficients for X, W, and X×W with SE, t, p. If the interaction term is significant, plot the interaction: show the X→Y relationship at W = mean, +1 SD, and −1 SD (Johnson-Neyman or simple slopes analysis). Report R², ΔR² for the interaction term.",
};

// ── Assumptions per test — what the AI must check and report ─────────────────

const TEST_ASSUMPTIONS: Record<string, { name: string; checks: string[] }> = {
  ttest_ind: {
    name: "Independent Samples t-test",
    checks: [
      "NORMALITY — Run Shapiro-Wilk test (W, p) separately for each group. If N > 50, use Kolmogorov-Smirnov (D, p). State: 'Normality was assessed using the Shapiro-Wilk test; the assumption was [met / violated] for [group names] (W = X.XX, p = .XXX).' If violated, justify switching to Mann-Whitney U.",
      "HOMOGENEITY OF VARIANCE — Report Levene's test for equality of variances: F(df1, df2) = X.XX, p = .XXX. If p < .05: variances are significantly unequal — use Welch's t-test (do not pool variances) and report Welch-Satterthwaite degrees of freedom.",
      "INDEPENDENCE OF OBSERVATIONS — Confirm participants in each group are unrelated (no repeated measures, no matched pairs). State this explicitly.",
      "SCALE OF MEASUREMENT — Confirm the dependent variable is continuous (interval or ratio scale).",
    ],
  },
  ttest_paired: {
    name: "Paired Samples t-test",
    checks: [
      "NORMALITY OF DIFFERENCES — Compute the difference score for each pair. Run Shapiro-Wilk (W, p) on the difference scores. State: 'Shapiro-Wilk test on the difference scores indicated normality was [met/violated] (W = X.XX, p = .XXX).' If violated, use Wilcoxon Signed-Rank test.",
      "DEPENDENCE — Confirm observations are paired/matched (same participant at two time points, or matched pairs design). State the pairing rationale.",
      "SCALE OF MEASUREMENT — Confirm the DV is continuous (interval or ratio scale).",
      "NO OUTLIERS IN DIFFERENCES — Identify any extreme difference scores (> 3 SD from the mean difference). Report and justify retaining or removing outliers.",
    ],
  },
  oneway_anova: {
    name: "One-way ANOVA",
    checks: [
      "NORMALITY — Run Shapiro-Wilk (W, p) on the DV separately within each group. Report each result. If violated in any group, note violation and consider Kruskal-Wallis as alternative.",
      "HOMOGENEITY OF VARIANCE (LEVENE'S TEST) — Report F(df_between, df_within) = X.XX, p = .XXX. If p < .05: use Welch's ANOVA (robust to unequal variances) or report Games-Howell post-hoc instead of Tukey.",
      "INDEPENDENCE OF OBSERVATIONS — Confirm all observations are from different participants (between-subjects design).",
      "SCALE OF MEASUREMENT — Confirm the DV is continuous. Confirm the IV is categorical with 3+ levels.",
    ],
  },
  twoway_anova: {
    name: "Two-way ANOVA",
    checks: [
      "NORMALITY — Run Shapiro-Wilk (W, p) on the DV within each combination of factor levels (each cell). Report any violations.",
      "HOMOGENEITY OF VARIANCE (LEVENE'S TEST) — Report Levene's F across all cells. If violated (p < .05), note it as a limitation; ANOVA is relatively robust with equal cell sizes.",
      "INDEPENDENCE — Confirm a fully between-subjects design (no repeated measures on either factor).",
      "SAMPLE SIZE BALANCE — Note whether the design is balanced (equal n per cell) or unbalanced. If unbalanced, report Type III sums of squares.",
      "INTERACTION — Examine whether a significant interaction is present before interpreting main effects. If interaction is significant, main effects must be interpreted conditionally.",
    ],
  },
  manova: {
    name: "MANOVA",
    checks: [
      "MULTIVARIATE NORMALITY — Report Box's M test: M = X.XX, F(df1, df2) = X.XX, p = .XXX. Box's M is highly sensitive; if p < .001, note the violation but proceed if group sizes are large and equal (MANOVA is robust under these conditions).",
      "HOMOGENEITY OF COVARIANCE MATRICES — Box's M test also assesses this. Describe the result.",
      "ABSENCE OF MULTICOLLINEARITY AMONG DVs — Check correlation matrix of DVs. Correlations between DVs should be moderate (r = .20–.70). If r > .90, DVs are redundant; if r < .20, MANOVA offers no advantage over separate ANOVAs.",
      "ABSENCE OF OUTLIERS — Report Mahalanobis distance for multivariate outlier detection (χ² critical value at p < .001). List any cases exceeding the threshold.",
      "SAMPLE SIZE — Minimum n > number of DVs in the smallest group. Report whether this assumption is met.",
    ],
  },
  repeated_anova: {
    name: "Repeated Measures ANOVA",
    checks: [
      "SPHERICITY (MAUCHLY'S TEST) — Report: W = X.XX, χ²(df) = X.XX, p = .XXX. If p < .05: sphericity is violated. Apply Greenhouse-Geisser correction (ε = X.XX) and report corrected F(df_GG), p. If ε < .75, use Greenhouse-Geisser; if ε ≥ .75, Huynh-Feldt correction is acceptable.",
      "NORMALITY — Assess normality of the DV at each time point/condition using Shapiro-Wilk. Report each result.",
      "NO SIGNIFICANT OUTLIERS — Check for outliers at each level using boxplots or z-scores (|z| > 3.29). Report and justify any retention/exclusion.",
    ],
  },
  mann_whitney: {
    name: "Mann-Whitney U Test",
    checks: [
      "ORDINAL OR CONTINUOUS DV — Confirm the DV is at least ordinal (rank-ordered values make sense). State this.",
      "INDEPENDENCE OF OBSERVATIONS — Confirm the two groups are independent (different participants, no matching).",
      "SIMILAR DISTRIBUTION SHAPE — For interpreting the test as a comparison of medians, the two groups' distributions should have the same shape (only differing in location). Inspect histograms or boxplots per group and comment. If shapes differ substantially, interpret as stochastic superiority rather than a median comparison.",
    ],
  },
  wilcoxon: {
    name: "Wilcoxon Signed-Rank Test",
    checks: [
      "PAIRED DATA — Confirm observations are paired (same participant measured twice, or matched pairs). State the pairing rationale.",
      "ORDINAL OR CONTINUOUS DV — Confirm the DV is at least ordinal.",
      "SYMMETRY OF DIFFERENCE SCORES — The distribution of difference scores should be approximately symmetric around the median. Inspect a histogram of differences.",
    ],
  },
  kruskal_wallis: {
    name: "Kruskal-Wallis H Test",
    checks: [
      "ORDINAL OR CONTINUOUS DV — Confirm the DV is at least ordinal.",
      "INDEPENDENCE — All observations from different participants (between-subjects).",
      "SIMILAR DISTRIBUTION SHAPE — For median comparison interpretation, distributions should be similarly shaped across groups. Inspect boxplots per group.",
      "ADEQUATE SAMPLE SIZE — Recommended: at least 5 observations per group for the H approximation to chi-square to be valid.",
    ],
  },
  friedman: {
    name: "Friedman Test",
    checks: [
      "WITHIN-SUBJECTS / REPEATED MEASURES DESIGN — Confirm same participants measured across all conditions/time points.",
      "ORDINAL OR CONTINUOUS DV — Confirm the DV is at least ordinal.",
      "ADEQUATE SAMPLE SIZE — At least 10 participants recommended for the chi-square approximation.",
    ],
  },
  pearson: {
    name: "Pearson Correlation",
    checks: [
      "LEVEL OF MEASUREMENT — Both variables must be continuous (interval or ratio scale). State this explicitly.",
      "LINEARITY — Examine a scatterplot of X vs Y. Describe whether the relationship appears linear. If curvilinear, Pearson r will underestimate the true association; consider Spearman instead.",
      "BIVARIATE NORMALITY — Both variables should be approximately normally distributed. Report Shapiro-Wilk for each. Visualise with a scatterplot with marginal histograms.",
      "HOMOSCEDASTICITY — The variance of Y should be consistent across all values of X (fan-shape in scatterplot indicates violation). Describe scatterplot pattern.",
      "NO SIGNIFICANT OUTLIERS — Identify bivariate outliers using leverage/influence statistics or visual inspection. Report any extreme points and whether they were retained or removed.",
    ],
  },
  spearman: {
    name: "Spearman Rank Correlation",
    checks: [
      "ORDINAL OR CONTINUOUS DV — Both variables must be at least ordinal.",
      "MONOTONIC RELATIONSHIP — The relationship should be monotonic (consistently increasing or decreasing), not necessarily linear. Examine the scatterplot.",
      "NO TIES OR FEW TIES — A large number of tied ranks can distort rs. Report the number of tied ranks if present.",
    ],
  },
  chi_square: {
    name: "Chi-Square Test of Independence",
    checks: [
      "INDEPENDENCE OF OBSERVATIONS — Each case must belong to exactly one cell (mutually exclusive categories). Confirm no participant is counted in multiple cells.",
      "EXPECTED FREQUENCIES — No cell should have an expected frequency < 5 (rule of thumb: > 80% of cells ≥ 5, no cell = 0). Report the minimum expected frequency. If violated: merge categories, use Fisher's exact test (2×2), or use likelihood ratio chi-square.",
      "LEVEL OF MEASUREMENT — Both variables must be categorical (nominal or ordinal). State variable types.",
      "ADEQUATE SAMPLE SIZE — Minimum total N ≥ 20. Report total N.",
    ],
  },
  fishers_exact: {
    name: "Fisher's Exact Test",
    checks: [
      "2×2 TABLE STRUCTURE — Confirm the data form a 2×2 contingency table.",
      "INDEPENDENCE OF OBSERVATIONS — Each case belongs to exactly one cell.",
      "FIXED MARGINAL TOTALS — The test assumes marginal totals are fixed by design; note if this is an approximation.",
    ],
  },
  simple_regression: {
    name: "Simple Linear Regression",
    checks: [
      "LINEARITY — Plot Y against X (scatterplot). Describe the pattern. If curved, consider polynomial regression or transformation. Report 'The scatterplot of [Y] on [X] indicated a linear relationship.'",
      "INDEPENDENCE OF RESIDUALS — Report Durbin-Watson statistic (d): values near 2.0 indicate no autocorrelation; d < 1.5 or d > 2.5 indicates potential autocorrelation.",
      "HOMOSCEDASTICITY OF RESIDUALS — Plot standardised residuals against predicted values. The spread should be roughly constant. Report 'Visual inspection of the residuals vs. fitted plot indicated [constant/non-constant] variance.'",
      "NORMALITY OF RESIDUALS — Report Shapiro-Wilk on standardised residuals (W, p). Inspect Q-Q plot. If violated, consider robust regression or bootstrap CIs.",
      "NO INFLUENTIAL OUTLIERS — Report Cook's distance (D) for all cases. Cases with D > 1 (or D > 4/N) are potentially influential. Report and justify retention.",
    ],
  },
  multiple_regression: {
    name: "Multiple Linear Regression",
    checks: [
      "LINEARITY — Plot Y against each predictor separately. Report whether linear relationships are evident.",
      "INDEPENDENCE OF RESIDUALS — Report Durbin-Watson (d); target range 1.5–2.5.",
      "HOMOSCEDASTICITY — Inspect residuals vs. fitted plot. Report 'Homoscedasticity was [supported/violated] based on visual inspection of the residual plot.'",
      "NORMALITY OF RESIDUALS — Shapiro-Wilk on standardised residuals (W, p) + Q-Q plot description.",
      "ABSENCE OF MULTICOLLINEARITY — For each predictor, report VIF and Tolerance. Flag any VIF > 10 (or > 5 for a conservative threshold) or Tolerance < .10. If multicollinearity detected: consider removing a predictor, combining predictors, or ridge regression.",
      "NO INFLUENTIAL OUTLIERS — Report leverage (h) and Cook's D. Identify any high-leverage high-influence cases.",
      "SAMPLE SIZE ADEQUACY — Minimum 10–20 cases per predictor (Green's rule: N ≥ 50 + 8m, where m = number of predictors). Report N and number of predictors.",
    ],
  },
  logistic_regression: {
    name: "Binary Logistic Regression",
    checks: [
      "BINARY OUTCOME — Confirm the DV is dichotomous (0/1, yes/no). State the event of interest and reference category.",
      "INDEPENDENCE OF OBSERVATIONS — Each case is independent. No repeated measurements.",
      "ABSENCE OF MULTICOLLINEARITY — Report VIF and Tolerance for all predictors. Same thresholds as linear regression (VIF < 10).",
      "LINEARITY OF LOG ODDS — For continuous predictors, test the Box-Tidwell procedure (add X × ln(X) interaction terms). If significant, the linearity assumption is violated. Report results.",
      "NO COMPLETE SEPARATION — Verify the outcome is not perfectly predicted by any predictor (complete separation causes inflated coefficients and SEs). Note if the model converged normally.",
      "ADEQUATE SAMPLE SIZE — Rule of thumb: ≥ 10–15 events (outcome = 1 cases) per predictor. Report: number of events, number of predictors, events-per-variable (EPV) ratio.",
    ],
  },
  polynomial_regression: {
    name: "Polynomial Regression",
    checks: [
      "MEAN-CENTRING — Confirm that continuous predictors have been mean-centred before computing polynomial terms (X − X̄) to reduce multicollinearity between X and X².",
      "HOMOSCEDASTICITY — Residuals vs fitted plot. Report pattern.",
      "NORMALITY OF RESIDUALS — Shapiro-Wilk (W, p) on residuals.",
      "INDEPENDENCE — Durbin-Watson (d).",
      "OVERFITTING RISK — Report whether cross-validation or AIC/BIC was used to select the polynomial degree.",
    ],
  },
  hierarchical_regression: {
    name: "Hierarchical Regression",
    checks: [
      "THEORY-DRIVEN BLOCK ORDER — State the theoretical or empirical justification for the order of predictor entry across blocks.",
      "ALL LINEAR REGRESSION ASSUMPTIONS — Apply all five OLS assumptions (linearity, independence, homoscedasticity, normality of residuals, no multicollinearity) to the FINAL model.",
      "F-CHANGE SIGNIFICANCE — For each block, report ΔF test: F(df_new, df_residual) = X.XX, p = .XXX. This confirms whether each block adds incremental predictive power.",
    ],
  },
  pca: {
    name: "Principal Component Analysis (PCA)",
    checks: [
      "SAMPLING ADEQUACY (KMO) — Report Kaiser-Meyer-Olkin measure: KMO = X.XX. Interpret: ≥ .90 marvellous, .80–.89 meritorious, .70–.79 middling, .60–.69 mediocre, < .60 unacceptable. KMO < .60 means PCA is not appropriate.",
      "BARTLETT'S TEST OF SPHERICITY — Report χ²(df) = X.XX, p = .XXX. If p < .05, the correlation matrix is not an identity matrix, meaning PCA is appropriate. If p > .05, variables are uncorrelated — PCA is not meaningful.",
      "INTERCORRELATIONS — Examine the correlation matrix. At least some correlations should be ≥ .30. If most correlations are < .30, PCA is unlikely to yield interpretable components.",
      "SAMPLE SIZE — Minimum N = 100, or 5:1 to 10:1 ratio of cases to variables. Report N and number of variables.",
      "ABSENCE OF EXTREME OUTLIERS — Outliers can distort components. Check Mahalanobis distance.",
    ],
  },
  factor_analysis: {
    name: "Exploratory Factor Analysis (EFA)",
    checks: [
      "SAMPLING ADEQUACY (KMO) — Same as PCA: report KMO ≥ .60 as minimum. Interpret the value.",
      "BARTLETT'S TEST — χ²(df) = X.XX, p < .05 required for EFA to be appropriate.",
      "FACTORABILITY OF CORRELATION MATRIX — Report the proportion of correlations ≥ .30. Note any variables with all correlations < .30 (candidates for removal).",
      "SAMPLE SIZE — N ≥ 200 for stable solutions (Comrey & Lee, 1992). Report N.",
      "COMMUNALITIES — After extraction, report communalities (h²). Variables with h² < .30 are weakly related to other variables and should be considered for removal.",
    ],
  },
  cluster_kmeans: {
    name: "K-means Cluster Analysis",
    checks: [
      "STANDARDISATION — Confirm all variables have been standardised (z-scores) before clustering to prevent variables with larger scales from dominating the Euclidean distance metric. Report: 'Variables were standardised (M = 0, SD = 1) prior to clustering.'",
      "OPTIMAL K SELECTION — Report the method used to select k: (a) Elbow method: plot within-cluster sum of squares (WSS) against k and identify the 'elbow'; (b) Silhouette score: report average silhouette width for k = 2 to k = N/2, with higher values indicating better separation; (c) Gap statistic if used.",
      "STABILITY / REPLICABILITY — Note that k-means solutions can vary with different random seeds. Report the random seed used and/or that the solution was confirmed across multiple runs.",
      "OUTLIERS — K-means is sensitive to outliers. Report any outlier screening conducted prior to analysis.",
    ],
  },
  reliability: {
    name: "Reliability Analysis (Cronbach's α)",
    checks: [
      "UNIDIMENSIONALITY — Reliability analysis assumes all items measure a single underlying construct. Confirm this with EFA or inter-item correlation matrix (all r > .20). If items cluster into sub-factors, Cronbach's α for the full scale is misleading — compute α per sub-scale.",
      "CONTINUOUS OR POLYTOMOUS ITEMS — Confirm items are rated on a continuous or Likert-type scale (at least 5 response options). For dichotomous items, Kuder-Richardson KR-20 is more appropriate than α.",
      "MINIMUM NUMBER OF ITEMS — At least 3 items recommended. Note the number of items.",
      "SAMPLE SIZE — Minimum N = 50–100 for stable α estimates. Report N.",
    ],
  },
  mediation: {
    name: "Mediation Analysis",
    checks: [
      "CAUSAL ASSUMPTIONS — Mediation implies a causal chain (X → M → Y). Clearly state the theoretical basis for the causal ordering. Cross-sectional data cannot establish causality — acknowledge this limitation.",
      "REGRESSION ASSUMPTIONS — All OLS regression assumptions apply to each path model (linearity, independence, homoscedasticity, normality of residuals, no multicollinearity between X and M in the path b model).",
      "MEASUREMENT OF MEDIATOR — The mediator M must be measured before or concurrent with Y, and after or concurrent with X in the causal sequence. State the measurement order.",
      "NO UNMEASURED CONFOUNDERS — Mediation inference requires no confounding of the M → Y relationship. Acknowledge potential confounders not included in the model.",
    ],
  },
  moderation: {
    name: "Moderation / Interaction Analysis",
    checks: [
      "MEAN-CENTRING — Continuous predictors (X and W) must be mean-centred before computing the interaction term X×W to reduce multicollinearity and improve interpretability of lower-order coefficients. Report: 'X and W were mean-centred prior to computing the interaction term.'",
      "MULTICOLLINEARITY — After mean-centring, report VIF for X, W, and X×W. VIF < 10 indicates acceptable multicollinearity.",
      "HOMOSCEDASTICITY AND NORMALITY — Full OLS regression assumption checks apply to the final moderation model.",
      "POWER — Interaction effects typically require larger samples to detect than main effects. Report whether power was considered (G*Power or rule of thumb: N ≥ 200 for reliable moderation detection).",
    ],
  },
  time_series: {
    name: "Time Series / Trend Analysis",
    checks: [
      "STATIONARITY — Test whether the mean and variance are constant over time. Report Augmented Dickey-Fuller (ADF) test if applicable: ADF statistic, p-value. If non-stationary (p > .05), note that differencing or detrending may be required.",
      "AUTOCORRELATION — Report Durbin-Watson (d) for regression-based trend analysis, or ACF/PACF plots for time series modelling. Significant autocorrelation at lag 1 may require an AR(1) or ARIMA model.",
      "EQUAL TIME INTERVALS — Confirm observations are equally spaced in time. Note any missing time points.",
      "SUFFICIENT OBSERVATIONS — Minimum 30–50 time points for reliable trend and autocorrelation estimation. Report the number of time points.",
    ],
  },
  survival: {
    name: "Survival Analysis (Kaplan-Meier)",
    checks: [
      "CENSORING — Confirm censoring is non-informative (censored subjects do not systematically differ from those who experienced the event). State the censoring mechanism (e.g., end of study, withdrawal).",
      "PROPORTIONAL HAZARDS (FOR COX MODEL) — If a Cox model is used, test the proportional hazards assumption using Schoenfeld residuals (χ², p > .05 indicates assumption is met). Alternatively, plot log(−log(survival)) against log(time) — parallel lines indicate proportional hazards.",
      "INDEPENDENCE OF SURVIVAL TIMES — Each participant's survival time is independent of others'. No clustering or matching (or account for it with stratified/frailty models).",
      "NO TIED EVENT TIMES (OR METHOD FOR HANDLING) — Kaplan-Meier handles ties using Breslow or Efron method. State the method used.",
    ],
  },
};

function buildAssumptionsContext(selectedTests: string[], includeAssumptionsCheck: boolean): string {
  if (!includeAssumptionsCheck) return "";
  if (!selectedTests || selectedTests.length === 0) {
    // Generic assumptions reminder when no specific tests are selected
    return `
ASSUMPTIONS CHECK (GENERAL):
Before reporting any inferential statistics, include a brief "Assumptions Testing" subsection in the Methodology or Results section.
For each statistical test you choose to run:
1. Name the test and list its key assumptions
2. State how each assumption was assessed (test name and output, or visual inspection)
3. State whether each assumption was met or violated
4. If violated, state what correction or alternative was applied
This subsection should precede the presentation of inferential results.`;
  }

  const testEntries = selectedTests
    .map(t => TEST_ASSUMPTIONS[t])
    .filter(Boolean);

  if (testEntries.length === 0) return "";

  const checkLines = testEntries.map(entry => {
    const checks = entry.checks.map((c, i) => `   ${i + 1}. ${c}`).join("\n");
    return `▸ ${entry.name}:\n${checks}`;
  }).join("\n\n");

  return `
MANDATORY ASSUMPTIONS TESTING SECTION:
Write a dedicated "Assumptions Testing" subsection within the Methodology section (or immediately before the Results if the paper structure does not include a Methodology section). This section MUST appear in the paper before the inferential results are presented.

Structure the subsection as follows:
• Title the subsection: "Testing of Statistical Assumptions" or "Assumption Checks"
• For each test below, systematically report every numbered check in sequence
• Use the exact statistic names and formatting specified
• If an assumption is violated, explicitly state what alternative or correction was applied and why
• Reference the tool-specific output format previously specified (SPSS output labels, R console, etc.)

REQUIRED ASSUMPTION CHECKS (one sub-paragraph per test):
${checkLines}

CRITICAL RULE: Do NOT present any inferential test result (t, F, χ², r, B, OR, etc.) before first reporting the relevant assumption checks for that test in the Assumptions Testing subsection.`;
}

function buildTestsContext(selectedTests: string[]): string {
  if (!selectedTests || selectedTests.length === 0) return "";

  const instructions = selectedTests
    .map(t => TEST_INSTRUCTIONS[t])
    .filter(Boolean);

  if (instructions.length === 0) return "";

  return `
REQUIRED STATISTICAL TESTS (student-specified — ALL must be performed and fully reported):
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join("\n\n")}

CRITICAL: Every test listed above MUST appear in the Results section with all reported statistics listed. Do not skip or summarise any test. If the data does not perfectly suit a test (e.g., only one group present for a t-test), acknowledge the limitation and report what is computable from the available data.`;
}

export function parseAndAnalyzeDataset(csvText: string, analysisTool?: string, selectedTests?: string[], includeAssumptionsCheck?: boolean): string {
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
  const testsContext = buildTestsContext(selectedTests ?? []);
  const assumptionsContext = buildAssumptionsContext(selectedTests ?? [], includeAssumptionsCheck ?? false);

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
${testsContext}
${assumptionsContext}

MANDATORY DATA USAGE RULES:
1. Present and discuss the ACTUAL statistics above — never invent alternative numbers
2. Include at least one properly formatted markdown table showing key statistics
3. Reference specific values (means, SD, ranges, correlations) with precision
4. Interpret what the specific results mean in context of the question or subject
5. Report trends, patterns, or notable distributions observed in the data
6. Describe at least one visualisation (chart/graph) in text — explain what it shows using the real data values
7. If correlations are provided, discuss their strength, direction, and practical significance
8. Use quartiles and IQR to discuss data spread and identify potential outliers
9. FOLLOW THE ANALYSIS TOOL CONVENTIONS ABOVE — use the exact function names, output labels, and reporting format for the specified tool so the student can reproduce the analysis${testsContext ? "\n10. PERFORM EVERY TEST LISTED IN THE REQUIRED STATISTICAL TESTS SECTION — do not omit any" : ""}${isFinancialData ? `
${testsContext ? "11" : "10"}. Present ALL computed financial ratios and interpret them against industry benchmarks
${testsContext ? "12" : "11"}. Calculate and discuss year-over-year or period-over-period growth rates
${testsContext ? "13" : "12"}. Perform horizontal (trend) and vertical (common-size) analysis where applicable
${testsContext ? "14" : "13"}. Discuss financial health, solvency, liquidity, and profitability based on the ratios` : ""}`;
}
