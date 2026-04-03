// Curated from:
//   Repo 1: awesome-ai-for-science (github.com/zawaditechnologiesllc/awesome-ai-for-science)
//   Repo 2: AIAgents4Pharmabio (github.com/zawaditechnologiesllc/AIAgents4Pharmabio)
// Mapped to each STEM subject for the Light Speed Ghost STEM solver

export interface StemTool {
  name: string;
  url: string;
  description: string;
  type: "library" | "api" | "model" | "framework" | "tool";
}

export interface StemResourceGroup {
  label: string;
  tools: StemTool[];
}

export const stemResourcesBySubject: Record<string, StemResourceGroup[]> = {
  mathematics: [
    {
      label: "Symbolic & Numeric Computation",
      tools: [
        { name: "SymPy", url: "https://www.sympy.org/", description: "Symbolic mathematics: algebra, calculus, equation solving", type: "library" },
        { name: "NumPy", url: "https://numpy.org/", description: "High-speed matrix operations and linear algebra", type: "library" },
        { name: "SciPy", url: "https://scipy.org/", description: "Integration, differential equations, signal processing", type: "library" },
        { name: "Wolfram Alpha", url: "https://www.wolframalpha.com/", description: "Computation engine for step-by-step math solutions", type: "api" },
      ],
    },
    {
      label: "Equation Discovery",
      tools: [
        { name: "PySR", url: "https://github.com/MilesCranmer/PySR", description: "Symbolic regression — discover interpretable equations from data", type: "library" },
        { name: "LLM-SR", url: "https://github.com/deep-symbolic-mathematics/LLM-SR", description: "LLM-powered scientific equation discovery (ICLR 2025 Oral)", type: "model" },
      ],
    },
    {
      label: "Literature Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered academic search across 200M+ papers (Allen AI)", type: "api" },
        { name: "arXiv", url: "https://arxiv.org/", description: "Open-access preprints and research papers in math & CS", type: "api" },
        { name: "OpenAlex", url: "https://openalex.org/", description: "Open catalog of scholarly papers, authors, and citations", type: "api" },
      ],
    },
  ],

  physics: [
    {
      label: "Physics-Informed Neural Networks",
      tools: [
        { name: "DeepXDE", url: "https://github.com/lululxvi/deepxde", description: "Deep learning library for solving PDEs and physics problems", type: "library" },
        { name: "PINA", url: "https://github.com/mathLab/PINA", description: "Physics-Informed Neural Networks in PyTorch for advanced modeling", type: "framework" },
        { name: "Lang-PINN", url: "https://openreview.net/forum?id=ONEyVpgK34", description: "LLM-driven PINN builder from natural language descriptions (ICLR 2026)", type: "model" },
        { name: "NVIDIA PhysicsNeMo", url: "https://github.com/NVIDIA/physicsnemo", description: "Open-source framework for physics-ML models at scale", type: "framework" },
      ],
    },
    {
      label: "Molecular Dynamics & Simulation",
      tools: [
        { name: "JAX-MD", url: "https://github.com/jax-md/jax-md", description: "Molecular dynamics simulation in JAX", type: "library" },
        { name: "torchdiffeq", url: "https://github.com/rtqichen/torchdiffeq", description: "Neural ODEs and differential equations in PyTorch", type: "library" },
        { name: "SciPy", url: "https://scipy.org/", description: "Differential equations, integration, optimization", type: "library" },
      ],
    },
    {
      label: "Weather & Climate Physics",
      tools: [
        { name: "Aurora (Microsoft)", url: "https://github.com/microsoft/aurora", description: "Foundation model for Earth system — weather, ocean waves, air pollution", type: "model" },
        { name: "GenCast (Google DeepMind)", url: "https://github.com/google-deepmind/graphcast", description: "Diffusion-based ensemble weather forecast, 97.2% accuracy (Nature 2024)", type: "model" },
      ],
    },
    {
      label: "Literature Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered academic search (Allen AI)", type: "api" },
        { name: "arXiv Physics", url: "https://arxiv.org/list/physics/recent", description: "Latest physics preprints and papers", type: "api" },
        { name: "OpenAlex", url: "https://openalex.org/", description: "Open catalog of scholarly papers", type: "api" },
      ],
    },
  ],

  chemistry: [
    {
      label: "Cheminformatics & Molecular Design",
      tools: [
        { name: "RDKit", url: "https://www.rdkit.org/", description: "Industry-standard cheminformatics and molecular manipulation", type: "library" },
        { name: "DeepChem", url: "https://deepchem.io/", description: "Drug discovery and quantum chemistry with deep learning", type: "library" },
        { name: "ChemCrow", url: "https://github.com/ur-whitelab/chemcrow-public", description: "LLM agent for chemistry research with specialized tools", type: "tool" },
        { name: "DiffDock", url: "https://github.com/gcorso/DiffDock", description: "Diffusion-based molecular docking — SOTA blind docking (MIT, ICLR 2023)", type: "model" },
      ],
    },
    {
      label: "Drug Discovery & Protein Design",
      tools: [
        { name: "Uni-Mol", url: "https://github.com/deepmodeling/Uni-Mol", description: "Universal 3D molecular pretraining — 209M conformations (ICLR 2023)", type: "model" },
        { name: "DrugAssist", url: "https://github.com/blazerye/DrugAssist", description: "LLM-based molecular optimization tool", type: "tool" },
        { name: "Mol-Instructions", url: "https://github.com/zjunlp/Mol-Instructions", description: "Biomolecular instruction dataset for chemistry/biology LLMs (ICLR 2024)", type: "tool" },
      ],
    },
    {
      label: "Literature & Knowledge Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered academic chemistry search", type: "api" },
        { name: "PaperQA2", url: "https://github.com/future-house/paper-qa", description: "High-accuracy RAG for scientific PDFs with citation support", type: "tool" },
        { name: "Talk2Scholars (AIAgents4Pharmabio)", url: "https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio", description: "AI agent for pharmaceutical paper search, recommendations, and Zotero integration", type: "tool" },
        { name: "Robin (FutureHouse)", url: "https://github.com/Future-House/robin", description: "End-to-end drug discovery agent — first AI-generated novel AMD therapeutic (2025)", type: "model" },
      ],
    },
  ],

  biology: [
    {
      label: "AI Pharma & Bio Agents (AIAgents4Pharmabio)",
      tools: [
        { name: "Talk2BioModels", url: "https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio", description: "Converse with curated EBI BioModels — simulate, scan parameters, analyze steady state", type: "framework" },
        { name: "Talk2Scholars", url: "https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio", description: "AI agent for paper search, recommendations, Zotero integration (Semantic Scholar)", type: "tool" },
        { name: "Talk2KnowledgeGraphs", url: "https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio", description: "GraphRAG reasoning over biological knowledge graphs — subgraph extraction & summarization", type: "framework" },
        { name: "Talk2Cells", url: "https://github.com/zawaditechnologiesllc/AIAgents4Pharmabio", description: "AI agent for cellular biology data analysis and interaction", type: "tool" },
      ],
    },
    {
      label: "BioModels Database & Simulation",
      tools: [
        { name: "EBI BioModels", url: "https://www.ebi.ac.uk/biomodels/", description: "8,000+ manually curated mathematical models of biological systems (EMBL-EBI)", type: "api" },
        { name: "basico", url: "https://github.com/copasi/basico", description: "Python interface to COPASI for simulating BioModels (ODE/stochastic)", type: "library" },
        { name: "COPASI", url: "http://copasi.org/", description: "Complex pathway simulator — ODE integration, parameter estimation, stochastic simulation", type: "tool" },
        { name: "BioSimulators", url: "https://github.com/biosimulators/Biosimulators", description: "Standardized interfaces to 20+ biological simulation engines", type: "framework" },
      ],
    },
    {
      label: "Protein Structure & Drug Discovery",
      tools: [
        { name: "AlphaFold (Google DeepMind)", url: "https://github.com/google-deepmind/alphafold", description: "State-of-the-art protein structure prediction", type: "model" },
        { name: "Chai-1", url: "https://github.com/chaidiscovery/chai-lab", description: "Biomolecular structure prediction — proteins, DNA, RNA, small molecules", type: "model" },
        { name: "Boltz", url: "https://github.com/jwohlwend/boltz", description: "First fully open-source AlphaFold3-level model — 1000x faster binding affinity (MIT)", type: "model" },
        { name: "BioEmu (Microsoft)", url: "https://github.com/microsoft/bioemu", description: "Sample protein conformations 100,000x faster than MD simulations (Science 2025)", type: "model" },
        { name: "ProteinMPNN", url: "https://github.com/dauparas/ProteinMPNN", description: "Deep learning protein sequence design — 52.4% sequence recovery (Science 2022)", type: "model" },
      ],
    },
    {
      label: "Bioinformatics & Genomics",
      tools: [
        { name: "Biopython", url: "https://biopython.org/", description: "Essential tools for genomics and biological data analysis", type: "library" },
        { name: "mint", url: "https://github.com/VarunUllanat/mint", description: "Learning the language of protein-protein interactions", type: "model" },
        { name: "LabClaw (Stanford LabOS)", url: "https://github.com/wu-yc/LabClaw", description: "211 production-ready skill files across biology, pharmacology, medicine & data science", type: "framework" },
      ],
    },
    {
      label: "Literature & Knowledge Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered biology/medicine search — 200M+ papers (Allen AI)", type: "api" },
        { name: "Zotero + PapersGPT", url: "https://github.com/papersgpt/papersgpt-for-zotero", description: "Multi-PDF conversation, retrieval, and citation in Zotero with Ollama/local models", type: "tool" },
        { name: "OpenScholar", url: "https://github.com/AkariAsai/OpenScholar", description: "RAG over 45M scientific papers — human-expert level accuracy (Nature 2026)", type: "model" },
        { name: "PaperQA2", url: "https://github.com/future-house/paper-qa", description: "High-accuracy RAG for scientific PDFs with contradiction detection", type: "tool" },
      ],
    },
  ],

  engineering: [
    {
      label: "Scientific ML & Optimization",
      tools: [
        { name: "SciPy", url: "https://scipy.org/", description: "Integration, optimization, signal processing for engineers", type: "library" },
        { name: "DeepXDE", url: "https://github.com/lululxvi/deepxde", description: "PDE solver with physics-informed neural networks", type: "library" },
        { name: "Fourier Neural Operator", url: "https://github.com/neuraloperator/neuraloperator", description: "Learning operators in Fourier space for PDEs", type: "model" },
        { name: "DeepONet", url: "https://github.com/lululxvi/deeponet", description: "Learning nonlinear operators for engineering applications", type: "model" },
      ],
    },
    {
      label: "Simulation & Modeling",
      tools: [
        { name: "torchdiffeq", url: "https://github.com/rtqichen/torchdiffeq", description: "Neural ODEs for dynamic system modeling", type: "library" },
        { name: "PySINDy", url: "https://github.com/dynamicslab/pysindy", description: "Sparse identification of nonlinear dynamics from data", type: "library" },
        { name: "NVIDIA PhysicsNeMo", url: "https://github.com/NVIDIA/physicsnemo", description: "Physics-ML models at industrial scale", type: "framework" },
      ],
    },
    {
      label: "Literature Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered engineering research search", type: "api" },
        { name: "arXiv Engineering", url: "https://arxiv.org/list/eess/recent", description: "Latest engineering & systems preprints", type: "api" },
      ],
    },
  ],

  computer_science: [
    {
      label: "AI Research Tools",
      tools: [
        { name: "Jupyter AI", url: "https://github.com/jupyterlab/jupyter-ai", description: "Official Jupyter extension with AI magic commands and sidebar chat", type: "tool" },
        { name: "ToolUniverse (Harvard)", url: "https://github.com/mims-harvard/ToolUniverse", description: "600+ scientific tools for transforming any LLM into a research system", type: "framework" },
        { name: "AI Scientist v2", url: "https://arxiv.org/abs/2504.08066", description: "Fully autonomous research system — hypothesis to paper (2025)", type: "model" },
      ],
    },
    {
      label: "Code & Data Analysis",
      tools: [
        { name: "PandasAI", url: "https://github.com/Sinaptik-AI/pandas-ai", description: "Conversational data analysis with natural language", type: "library" },
        { name: "DeepAnalyze", url: "https://github.com/ruc-datalab/DeepAnalyze", description: "Agentic LLM for autonomous data science — end-to-end pipeline", type: "tool" },
        { name: "Paper-to-Code", url: "https://paperswithcode.com/", description: "Reproducible ML papers with code implementations", type: "tool" },
      ],
    },
    {
      label: "Literature Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered CS academic search (Allen AI)", type: "api" },
        { name: "Papers With Code", url: "https://paperswithcode.com/", description: "ML papers with SOTA benchmarks and code", type: "tool" },
        { name: "arXiv CS", url: "https://arxiv.org/list/cs/recent", description: "Latest CS preprints", type: "api" },
      ],
    },
  ],

  statistics: [
    {
      label: "Statistical Computing",
      tools: [
        { name: "SciPy Stats", url: "https://docs.scipy.org/doc/scipy/reference/stats.html", description: "Hypothesis testing, distributions, regression analysis", type: "library" },
        { name: "NumPy", url: "https://numpy.org/", description: "Array operations and linear algebra for statistics", type: "library" },
        { name: "Snorkel", url: "https://github.com/snorkel-team/snorkel", description: "Programmatic data labeling and weak supervision", type: "library" },
      ],
    },
    {
      label: "Data Visualization",
      tools: [
        { name: "AutoViz", url: "https://github.com/AutoViML/AutoViz", description: "Automated data visualization with minimal code", type: "library" },
        { name: "Chat2Plot", url: "https://github.com/nyanp/chat2plot", description: "Secure text-to-visualization through standardized chart specs", type: "tool" },
        { name: "PandasAI", url: "https://github.com/Sinaptik-AI/pandas-ai", description: "Conversational data analysis using natural language", type: "library" },
      ],
    },
    {
      label: "Literature Search",
      tools: [
        { name: "Semantic Scholar", url: "https://www.semanticscholar.org/", description: "AI-powered academic search across 200M+ papers", type: "api" },
        { name: "OpenAlex", url: "https://openalex.org/", description: "Open catalog of scholarly papers with citation data", type: "api" },
      ],
    },
  ],
};

export const toolTypeColors: Record<string, string> = {
  library: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  api: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  model: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  framework: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  tool: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
};
