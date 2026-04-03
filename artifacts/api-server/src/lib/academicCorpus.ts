/**
 * Academic reference corpus for text plagiarism detection.
 * Seed corpus from: https://github.com/Churanta/Plagiarism-Checker-and-AI-Text-Detection
 * (database1.txt) — expanded with additional academic domains relevant to student writing.
 */

export interface CorpusSource {
  label: string;
  category: string;
  text: string;
}

export const ACADEMIC_CORPUS: CorpusSource[] = [
  {
    label: "AI & Machine Learning Overview",
    category: "computer-science",
    text: `Artificial intelligence is the simulation of human intelligence processes by machines, especially computer systems. Specific applications of AI include expert systems, natural language processing, speech recognition and machine vision. As the hype around AI has accelerated, vendors have been scrambling to promote how their products and services use it. Often, what they refer to as AI is simply a component of the technology, such as machine learning. AI requires a foundation of specialized hardware and software for writing and training machine learning algorithms. No single programming language is synonymous with AI, but Python, R, Java, C++ and Julia have features popular with AI developers. In general, AI systems work by ingesting large amounts of labeled training data, analyzing the data for correlations and patterns, and using these patterns to make predictions about future states. In this way, a chatbot that is fed examples of text can learn to generate lifelike exchanges with people, or an image recognition tool can learn to identify and describe objects in images by reviewing millions of examples.`,
  },
  {
    label: "Deep Learning & Neural Networks",
    category: "computer-science",
    text: `Deep learning is a subset of machine learning that uses artificial neural networks with multiple layers to learn representations of data with multiple levels of abstraction. Machine learning enables software applications to become more accurate at predicting outcomes without being explicitly programmed to do so. Machine learning algorithms use historical data as input to predict new output values. This approach became vastly more effective with the rise of large data sets to train on. Deep learning's use of artificial neural networks structure is the underpinning of recent advances in AI, including self-driving cars and ChatGPT. Neural networks are computing systems inspired by the biological neural networks that constitute animal brains. These systems learn to perform tasks by considering examples, generally without being programmed with task-specific rules. A neural network consists of layers of interconnected nodes or neurons that process information using connectionist approaches to computation.`,
  },
  {
    label: "Research Methodology",
    category: "academic-writing",
    text: `Research methodology is the specific procedures or techniques used to identify, select, process, and analyze information about a topic. In a research paper, the methodology section allows the reader to critically evaluate a study's overall validity and reliability. A research method is the strategy used to implement that plan. Research design and research methods are different, with internal and external validity, and construct validity forming the basis. Qualitative research involves collecting and analyzing non-numerical data to understand concepts, opinions, or experiences. Quantitative research involves collecting and analyzing numerical data for statistical analysis. Mixed methods research combines both qualitative and quantitative approaches. The scientific method requires that research be systematic, empirical, and replicable. A hypothesis is a testable prediction that is derived from a theory and can be confirmed or disconfirmed by empirical data.`,
  },
  {
    label: "Climate Change & Environmental Science",
    category: "environmental-science",
    text: `Climate change refers to long-term shifts in temperatures and weather patterns. These shifts may be natural, such as through variations in the solar cycle. But since the 1800s, human activities have been the main driver of climate change, primarily due to the burning of fossil fuels like coal, oil and gas. The greenhouse effect is the process by which radiation from a planet's atmosphere warms the planet's surface to a temperature above what it would be without this atmosphere. Greenhouse gases such as carbon dioxide, methane, nitrous oxide, and water vapor trap heat in the atmosphere. Global warming is the long-term heating of Earth's climate system observed since the pre-industrial period due to human activities, primarily fossil fuel burning. The Intergovernmental Panel on Climate Change synthesizes research on the science of climate change and its impacts, and estimates that global average temperatures have increased by approximately 1.1 degrees Celsius since the pre-industrial period.`,
  },
  {
    label: "Academic Writing & Citation",
    category: "academic-writing",
    text: `Academic writing is a formal style of writing used in universities and scholarly publications. It adheres to specific conventions including the use of formal language, precise terminology, and citation of sources. The purpose of academic writing is to communicate complex ideas clearly and precisely. Citation is the practice of referring to sources used in research. Common citation styles include APA, MLA, Chicago, and Harvard. A bibliography or reference list provides full details of all sources cited in the text. Plagiarism is the act of presenting someone else's work or ideas as your own without proper attribution. Academic integrity is the commitment to honesty and ethical conduct in all aspects of scholarly work. A thesis statement is a concise summary of the main point or claim of an essay or research paper. The peer review process involves experts in a field evaluating submitted research before publication to ensure quality and validity.`,
  },
  {
    label: "Quantum Computing",
    category: "computer-science",
    text: `Quantum computing is a type of computation that harnesses the collective properties of quantum states, such as superposition, interference, and entanglement, to perform calculations. Quantum computers are fundamentally different from classical computers. A quantum bit or qubit is the basic unit of quantum information. Unlike classical bits that must be in a state of 0 or 1, a qubit can be in a superposition of both states simultaneously. Quantum entanglement is a phenomenon where two or more particles become interconnected in such a way that the quantum state of each particle cannot be described independently. Quantum supremacy refers to the milestone when a quantum computer can solve a problem that classical computers practically cannot. Applications of quantum computing include cryptography, drug discovery, financial modeling, and optimization problems.`,
  },
  {
    label: "Biology & Genetics",
    category: "biology",
    text: `Biology is the scientific study of life. Genetics is the study of heredity, the process by which parents pass some of their characteristics to their children. DNA, or deoxyribonucleic acid, is a molecule that carries the genetic instructions used in the growth, development, functioning, and reproduction of all known living organisms. The human genome consists of approximately 3 billion base pairs of DNA organized into 23 pairs of chromosomes. Gene expression is the process by which information from a gene is used in the synthesis of a functional gene product such as a protein. CRISPR-Cas9 is a molecular tool that allows scientists to edit DNA sequences and modify gene function. Evolution by natural selection is the process by which traits that enhance survival and reproduction become more common in a population over time. The cell theory states that all living things are made up of cells, the cell is the basic unit of life, and all cells arise from pre-existing cells.`,
  },
  {
    label: "Economic Theory",
    category: "economics",
    text: `Economics is the social science that studies the production, distribution, and consumption of goods and services. Microeconomics focuses on the behavior of individuals and firms in making decisions regarding the allocation of limited resources. Macroeconomics is the study of aggregate economic indicators and the policies that affect them. Supply and demand is the model of price determination in a market. The law of supply states that sellers will supply more of a product at a higher price. The law of demand states that consumers will demand less of a product at a higher price. Gross domestic product is the total monetary or market value of all the finished goods and services produced within a country's borders in a specific time period. Inflation is the rate at which the general level of prices for goods and services rises. Monetary policy refers to the actions undertaken by a central bank to control the money supply and achieve macroeconomic goals.`,
  },
  {
    label: "Psychology & Cognitive Science",
    category: "psychology",
    text: `Psychology is the scientific study of mind and behavior. Cognitive psychology is the branch of psychology that studies mental processes including how people think, perceive, remember, and learn. The cognitive model suggests that our thoughts influence our feelings and behaviors. Memory is the faculty of the brain by which data or information is encoded, stored, and retrieved when needed. Working memory is a cognitive system with a limited capacity that temporarily holds information for use in cognitive tasks. Behavioral psychology focuses on observable behaviors and how they are acquired through conditioning. Classical conditioning is a type of learning where a conditioned stimulus is paired with an unconditioned stimulus. Operant conditioning involves learning through consequences such as rewards and punishments. Social psychology examines how people's thoughts, feelings, and behaviors are influenced by others. Cognitive biases are systematic patterns of deviation from rationality in judgment.`,
  },
  {
    label: "Mathematical Analysis & Calculus",
    category: "mathematics",
    text: `Calculus is the mathematical study of continuous change. Differential calculus concerns instantaneous rates of change and the slopes of curves. Integral calculus concerns the accumulation of quantities and the areas under and between curves. The fundamental theorem of calculus establishes the relationship between differentiation and integration. A derivative measures how a function changes as its input changes. The integral of a function represents the area under the curve of that function over a given interval. Linear algebra is the branch of mathematics concerning linear equations and linear functions and their representations through matrices and vector spaces. A matrix is a rectangular array of numbers arranged in rows and columns. Eigenvectors and eigenvalues are fundamental concepts in linear transformations. Statistics is the discipline that concerns the collection, organization, analysis, interpretation, and presentation of data. The normal distribution is a continuous probability distribution that is symmetric about the mean.`,
  },
  {
    label: "Biomedical Research & Pharmacology",
    category: "biology",
    text: `Pharmacology is the science concerned with the biological effects of drugs and chemicals. Clinical trials are research studies performed in people that are aimed at evaluating a medical, surgical, or behavioral intervention. A randomized controlled trial is a type of scientific experiment that aims to reduce bias when testing a new treatment. The placebo effect is when an inactive treatment that a patient believes is real causes the patient's health to improve. Drug absorption, distribution, metabolism, and excretion are the four main pharmacokinetic processes. The blood-brain barrier is a highly selective semipermeable border that separates the circulating blood from the brain and extracellular fluid. Bioavailability refers to the proportion of a drug that enters the circulation when introduced into the body and so is able to have an active effect. Proteomics is the large-scale study of proteins, particularly their structures and functions. Genomics refers to the study of the complete set of genes within an organism.`,
  },
  {
    label: "History & Political Science",
    category: "humanities",
    text: `History is the study of the past. Political science is the study of politics, government systems, and political behavior. Democracy is a form of government in which the people have the authority to deliberate and decide legislation. The separation of powers is a model for the governance of a state that divides governmental authority into branches. The social contract theory holds that individuals have consented to surrender some of their freedoms and submit to the authority of the ruler in exchange for protection. Geopolitics is the study of the effects of Earth's geography on politics and international relations. Nationalism is the belief that one's nation is superior to others and should be independent and self-governing. The United Nations was established in 1945 with the goal of promoting international cooperation and preventing future conflicts. Human rights are the fundamental rights and freedoms to which all humans are considered entitled. International law is the set of rules generally regarded and accepted as binding in relations between nations.`,
  },
];
