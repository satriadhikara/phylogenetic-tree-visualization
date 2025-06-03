import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent, type FormEvent, useEffect, useRef } from "react";
import axios from "axios";
import PhylogeneticTreeViewer from "../components/PhylogeneticTreeViewer";
import gsap from "gsap";

// Import shadcn components
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

export const Route = createFileRoute("/")({
	component: App,
});

interface TreeResponse {
	message: string;
	newick_tree?: string;
	error?: string;
}

function App() {
	const [fastaContent, setFastaContent] = useState<string>("");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [treeResult, setTreeResult] = useState<TreeResponse | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [pageReady, setPageReady] = useState<boolean>(false);
	const [showLanding, setShowLanding] = useState<boolean>(true);
	
	// Refs for landing page animation
	const containerRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const subtitleRef = useRef<HTMLParagraphElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const bubblesRef = useRef<HTMLDivElement>(null);
	const mainAppRef = useRef<HTMLDivElement>(null);

	const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
	
	useEffect(() => {
		if (!bubblesRef.current || !showLanding) return;

		const bubbleCount = 20;
		const bubbleContainer = bubblesRef.current;
		bubbleContainer.innerHTML = '';

		for (let i = 0; i < bubbleCount; i++) {
			const bubble = document.createElement("div");
			bubble.className = "bubble";
			
			// Random positions and sizes
			const size = Math.random() * 80 + 20;
			bubble.style.width = `${size}px`;
			bubble.style.height = `${size}px`;
			bubble.style.left = `${Math.random() * 100}%`;
			bubble.style.top = `${Math.random() * 100}%`;
			
			// Random transparency
			const opacity = Math.random() * 0.3 + 0.1;
			bubble.style.opacity = opacity.toString();
			
			// Random delay for animation
			const delay = Math.random() * 5;
			bubble.style.animationDelay = `${delay}s`;
			
			bubbleContainer.appendChild(bubble);
		}
	}, [showLanding]);

	useEffect(() => {
		if (!showLanding || !containerRef.current || !titleRef.current || !subtitleRef.current || !buttonRef.current) return;

		const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
		
		tl.set(containerRef.current, { autoAlpha: 0 })
		  .set(titleRef.current, { y: 50, opacity: 0 })
		  .set(subtitleRef.current, { y: 30, opacity: 0 })
		  .set(buttonRef.current, { scale: 0, opacity: 0 });
		
		tl.to(containerRef.current, { autoAlpha: 1, duration: 0.5 })
		  .to(titleRef.current, { y: 0, opacity: 1, duration: 1 })
		  .to(subtitleRef.current, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
		  .to(buttonRef.current, { scale: 1, opacity: 1, duration: 0.8 }, "-=0.4");

		const dna = document.getElementById("dna");
		if (dna) {
		  for (let i = 0; i < 20; i++) {
			const strand1 = document.createElement("div");
			strand1.className = "dna-strand";
			strand1.style.animationDelay = `${i * 0.15}s`;
			
			const strand2 = document.createElement("div");
			strand2.className = "dna-strand";
			strand2.style.animationDelay = `${i * 0.15 + 0.075}s`;
			
			dna.appendChild(strand1);
			dna.appendChild(strand2);
		  }
		}

		return () => {
		  tl.kill();
		};
	}, [showLanding]);
	
	useEffect(() => {
		if (!mainAppRef.current) return;
		
		gsap.set(mainAppRef.current, { opacity: 0 });
		gsap.set("header", { opacity: 0, y: -20 });
		gsap.set("main", { opacity: 0, y: 20 });
		gsap.set("footer", { opacity: 0 });
		
		if (!showLanding) {
			setPageReady(true);
		}
	}, []);
	
	const handleEnterApp = () => {
		const landingTl = gsap.timeline();

		landingTl.to(buttonRef.current, { 
			scale: 20, 
			opacity: 0, 
			duration: 1.2, 
			ease: "power2.in" 
		})
		.to(titleRef.current, { 
			y: -50, 
			opacity: 0, 
			duration: 0.5 
		}, "-=0.8")
		.to(subtitleRef.current, { 
			y: -30, 
			opacity: 0, 
			duration: 0.5 
		}, "-=0.7")
		.to(containerRef.current, { 
			backgroundColor: "rgba(6, 78, 59, 0)",
			duration: 0.5 
		}, "-=0.5");
		
		landingTl.add(() => {
			setShowLanding(false);
			
			const mainTl = gsap.timeline();
			mainTl.to(mainAppRef.current, { 
				opacity: 1, 
				duration: 0.5, 
				ease: "power2.out" 
			})
			.to("header", { 
				opacity: 1, 
				y: 0, 
				duration: 0.8, 
				ease: "power2.out" 
			}, "-=0.1")
			.to("main", { 
				opacity: 1, 
				y: 0, 
				duration: 0.8, 
				ease: "power2.out" 
			}, "-=0.4")
			.to("footer", { 
				opacity: 1, 
				duration: 0.6 
			}, "-=0.2")
			.call(() => setPageReady(true));
		});
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (event.target.files?.[0]) {
			setSelectedFile(event.target.files[0]);
			setFastaContent("");
			setError(null);
			setTreeResult(null);
		}
	};

	const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setFastaContent(event.target.value);
		setSelectedFile(null);
		setError(null);
		setTreeResult(null); 
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsLoading(true);
		setTreeResult(null);
		setError(null);

		if (!selectedFile && !fastaContent.trim()) {
			setError("Please upload a FASTA file or paste FASTA content.");
			setIsLoading(false);
			return;
		}

		try {
			let response: { data: TreeResponse };
			if (selectedFile) {
				const formData = new FormData();
				formData.append("file", selectedFile);
				response = await axios.post<TreeResponse>(
					`${API_BASE_URL}/api/process-sequences-file/`,
					formData,
					{ headers: { "Content-Type": "multipart/form-data" } },
				);
			} else {
				response = await axios.post<TreeResponse>(
					`${API_BASE_URL}/api/process-sequences-text/`,
					{ sequences_fasta: fastaContent },
				);
			}
			setTreeResult(response.data);
			if (response.data.error) {
				setError(`Backend error: ${response.data.error}`);
			}
		} catch (err) {
			console.error("API call failed:", err);
			if (axios.isAxiosError(err) && err.response) {
				const apiError =
					err.response.data.detail || err.response.data.error || err.message;
				setError(`Error: ${apiError}`);
				setTreeResult({ message: "Failed", error: apiError });
			} else {
				setError("An unexpected error occurred during API call.");
				setTreeResult({
					message: "Failed",
					error: "An unexpected error occurred.",
				});
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			{showLanding && (
				<div 
					ref={containerRef}
					className="landing-page fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-800 to-teal-600 overflow-hidden z-50"
				>
					<div ref={bubblesRef} className="bubbles absolute inset-0 overflow-hidden" />

					<div id="dna" className="dna-container absolute right-10 h-screen"></div>

					<div className="landing-content relative z-10 text-center px-4 max-w-2xl">
						<h1 
							ref={titleRef} 
							className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight"
						>
							<span className="block">Phylogenetic Tree</span>
							<span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-teal-100">
								Visualization
							</span>
						</h1>
						
						<p 
							ref={subtitleRef} 
							className="text-lg md:text-xl text-emerald-100 mb-10 leading-relaxed"
						>
							Explore evolutionary relationships with interactive visualizations and powerful analytics
						</p>
						
						<Button
							ref={buttonRef}
							onClick={handleEnterApp}
							className="px-8 py-6 bg-white hover:bg-emerald-50 text-emerald-800 text-lg font-medium rounded-full transition-all shadow-lg hover:shadow-xl animated-button"
						>
							Enter Application
						</Button>
					</div>
				</div>
			)}
			
			<div ref={mainAppRef} className={`min-h-screen bg-gradient-to-b from-emerald-50 to-teal-50 ${showLanding ? 'hidden' : ''}`}>
				<div className="container mx-auto py-8 px-4 max-w-4xl">
				<header className="text-center mb-8">
					<h1 className="text-4xl font-bold text-emerald-700 mb-3">
						Phylogenetic Tree Builder
					</h1>
					<p className="text-teal-600 max-w-lg mx-auto">
						Visualize evolutionary relationships between biological sequences
					</p>
				</header>

				<main className="space-y-8">
					<Card className="border-emerald-200 shadow-md overflow-hidden animated-card">
						<div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
						<CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
							<div className="flex items-center space-x-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6 text-emerald-600 card-icon transition-transform duration-300"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
									/>
								</svg>
								<CardTitle className="text-emerald-800">
									Input Sequence Data
								</CardTitle>
							</div>
							<CardDescription className="text-teal-600">
								Upload a FASTA file or paste your FASTA content below to
								generate a phylogenetic tree.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-6">
							<form onSubmit={handleSubmit} className="space-y-6">
								<div className="space-y-2">
									<label
										htmlFor="fasta-file"
										className="block text-sm font-medium text-emerald-700"
									>
										Upload FASTA File:
									</label>
									<div className="border-2 border-dashed border-emerald-200 rounded-lg p-6 bg-emerald-50 transition-colors hover:bg-emerald-100/50 hover:border-emerald-300">
										<Input
											type="file"
											id="fasta-file"
											accept=".fasta,.fa,.fna,.fas"
											onChange={handleFileChange}
											className="w-full"
										/>
										<p className="text-xs text-emerald-600 mt-2">
											Accepted formats: .fasta, .fa, .fna, .fas
										</p>
									</div>
								</div>

								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<span className="w-full border-t border-emerald-200" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-white px-4 text-teal-500 font-medium rounded-full border border-emerald-200">
											OR
										</span>
									</div>
								</div>

								<div className="space-y-2">
									<label
										htmlFor="fasta-text"
										className="block text-sm font-medium text-emerald-700"
									>
										Paste FASTA Content:
									</label>
									<Textarea
										id="fasta-text"
										rows={10}
										value={fastaContent}
										onChange={handleTextChange}
										placeholder=">Seq1&#10;ATGC...&#10;>Seq2&#10;CGTA..."
										className="w-full font-mono bg-emerald-50 border-emerald-200 focus:border-emerald-300 focus:ring-emerald-200"
									/>
									<p className="text-xs text-emerald-600">
										Include sequence identifiers (starting with &gt;) and
										nucleotide or protein sequences
									</p>
								</div>

								<Button
									type="submit"
									disabled={isLoading}
									className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium py-2 transition-all duration-200 shadow-md hover:shadow-lg animated-button"
								>
									{isLoading ? (
										<>
											<svg
												className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												/>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												/>
											</svg>
											Processing...
										</>
									) : (
										<>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-5 w-5 mr-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M13 10V3L4 14h7v7l9-11h-7z"
												/>
											</svg>
											Generate Tree
										</>
									)}
								</Button>
							</form>
						</CardContent>
					</Card>

					{error && (
						<div className="mt-6">
							<Card className="border-red-300 shadow-md overflow-hidden">
								<div className="h-1 bg-gradient-to-r from-red-400 to-red-500" />
								<CardContent className="pt-6 bg-red-50">
									<div className="flex items-center">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5 text-red-500 mr-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										<p className="text-red-600 font-medium">{error}</p>
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{treeResult && (
						<div className="mt-8">
							<Card className="border-emerald-200 shadow-md overflow-hidden tilt-card">
								<div className="tilt-card-shine"></div>
								<div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
								<CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
									<div className="flex items-center space-x-2">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-6 w-6 text-emerald-600"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5l7 7-7 7"
											/>
										</svg>
										<CardTitle className="text-emerald-800">Results</CardTitle>
									</div>
									<CardDescription className="text-teal-600">
										{treeResult.message}
									</CardDescription>
								</CardHeader>
								{treeResult.newick_tree && !treeResult.error && (
									<CardContent>
										<h3 className="text-lg font-medium mb-4 text-emerald-700 flex items-center">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-5 w-5 mr-2"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
												/>
											</svg>
											Phylogenetic Tree Visualization:
										</h3>
										<div className="border rounded-lg p-4 bg-slate-50 shadow-inner tilt-card-content">
											<PhylogeneticTreeViewer
												newickString={treeResult.newick_tree}
											/>
										</div>
									</CardContent>
								)}
								{treeResult.newick_tree && treeResult.error && (
									<CardFooter className="bg-amber-50 border-t border-amber-200 text-amber-700 p-4">
										<div className="flex items-center">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-5 w-5 mr-2"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
												/>
											</svg>
											<p>Backend Warning: {treeResult.error}</p>
										</div>
									</CardFooter>
								)}
							</Card>
						</div>
					)}
				</main>

				<footer className="mt-12 text-center text-sm text-teal-600">
					<p>
						© {new Date().getFullYear()} Phylogenetic Tree Builder • A Biotech
						Visualization Tool
					</p>
				</footer>
			</div>
		</div>
		</>
	);
}
