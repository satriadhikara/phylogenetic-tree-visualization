import type React from "react";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import gsap from "gsap";


interface ParsedNode {
	id: string;
	name: string;
	branch_length: number;
	children: ParsedNode[];
	x?: number;
	y?: number;
}

// Basic Newick Parser
function parseNewick(initialNewick: string): ParsedNode {
	let idCounter = 0;
	function newNode(data: Partial<ParsedNode> = {}): ParsedNode {
		return {
			id: data.id || `node-${idCounter++}`,
			name: data.name || "",
			branch_length:
				data.branch_length === undefined ? 0.1 : data.branch_length,
			children: data.children || [],
		};
	}

	const currentNewick = initialNewick.trim().replace(/;$/, "");

	function build(initialSubstring: string): Partial<ParsedNode> {
		let currentSubstring = initialSubstring;
		const nameMatch = currentSubstring.match(/^([^()[:\]]+)/);
		let name = "";
		if (nameMatch) {
			name = nameMatch[0];
			currentSubstring = currentSubstring.substring(name.length);
		}

		let branch_length = 0.1;
		const lengthMatch = currentSubstring.match(/^:([0-9.eE+-]+)/);
		if (lengthMatch) {
			branch_length = Number.parseFloat(lengthMatch[1]);
			if (Number.isNaN(branch_length)) branch_length = 0.1;
			currentSubstring = currentSubstring.substring(lengthMatch[0].length);
		}
		return { name, branch_length };
	}

	function parseChildren(substring: string): string[] {
		const children: string[] = [];
		let balance = 0;
		let start = 0;
		for (let i = 0; i < substring.length; i++) {
			if (substring[i] === "(") balance++;
			else if (substring[i] === ")") balance--;
			else if (substring[i] === "," && balance === 0) {
				children.push(substring.substring(start, i));
				start = i + 1;
			}
		}
		children.push(substring.substring(start));
		return children;
	}

	function buildRecursive(nwkString: string): ParsedNode {
		const firstParen = nwkString.indexOf("(");
		const lastParen = nwkString.lastIndexOf(")");

		if (firstParen === -1) {
			return newNode(build(nwkString));
		}

		const childrenString = nwkString.substring(firstParen + 1, lastParen);
		const metaString = nwkString.substring(lastParen + 1);

		const nodeData = build(metaString);
		const node = newNode(nodeData);

		const childSubstrings = parseChildren(childrenString);
		for (const childNwk of childSubstrings) {
			node.children.push(buildRecursive(childNwk));
		}
		return node;
	}

	if (
		!currentNewick ||
		typeof currentNewick !== "string" ||
		currentNewick.trim() === ""
	) {
		console.error("Invalid Newick string provided to parser:", currentNewick);
		return newNode({ name: "ErrorInvalidInput" });
	}

	try {
		return buildRecursive(currentNewick);
	} catch (e) {
		console.error("Error parsing Newick string:", e, "Input:", currentNewick);
		return newNode({ name: "ErrorParsing" });
	}
}

interface PhylogeneticTreeViewerProps {
	newickString: string | null;
	width?: number;
	height?: number;
}

const PhylogeneticTreeViewer: React.FC<PhylogeneticTreeViewerProps> = ({
	newickString,
	width = 700,
	height = 500,
}) => {
	const svgRef = useRef<SVGSVGElement | null>(null);

	useEffect(() => {
		console.log("[D3TreeViewer] Props:", { newickString, width, height });

		if (!svgRef.current) {
			console.log("[D3TreeViewer] svgRef not current. Aborting.");
			return;
		}

		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();

		if (svg.select("title").empty()) {
			svg.append("title").text("Phylogenetic Tree");
		}

		if (!newickString) {
			console.log("[D3TreeViewer] No Newick string provided.");
			const textElement = svg
				.append("text")
				.attr("x", 10)
				.attr("y", 20)
				.text("No tree data to display.");
			textElement.append("title").text("Status message: No tree data");
			return;
		}

		let parsedData: ParsedNode;
		try {
			parsedData = parseNewick(newickString);
			if (
				!parsedData ||
				parsedData.name === "ErrorInvalidInput" ||
				parsedData.name === "ErrorParsing"
			) {
				throw new Error("Failed to parse Newick string or got error node.");
			}
			console.log(
				"[D3TreeViewer] Parsed Newick Data:",
				JSON.parse(JSON.stringify(parsedData)),
			);
		} catch (error) {
			console.error("[D3TreeViewer] Error parsing Newick string:", error);
			const textElement = svg
				.append("text")
				.attr("x", 10)
				.attr("y", 20)
				.text("Error parsing Newick string. See console.");
			textElement.append("title").text("Error message: Parsing failed");
			return;
		}

		try {
			const root = d3.hierarchy(parsedData, (d) => d.children);

			const margin = { top: 20, right: 150, bottom: 20, left: 50 };
			const innerWidth = width - margin.left - margin.right;
			const innerHeight = height - margin.top - margin.bottom;

			if (innerWidth <= 0 || innerHeight <= 0) {
				console.warn(
					"[D3TreeViewer] Calculated innerWidth or innerHeight is not positive. Aborting render to prevent D3 errors.",
					{ innerWidth, innerHeight },
				);
				const textElement = svg
					.append("text")
					.attr("x", 10)
					.attr("y", 20)
					.text("Cannot render tree: container too small.");
				textElement.append("title").text("Error message: Container too small");
				return;
			}

			const treeLayout = d3.tree<ParsedNode>().size([innerHeight, innerWidth]);
			const treeRoot = treeLayout(root);

			const g = svg
				.append("g")
				.attr("transform", `translate(${margin.left},${margin.top})`);

			// Custom function to create rectangular paths for phylogenetic trees
			function createRectangularPath(d: d3.HierarchyLink<ParsedNode>) {
				const source = d.source as d3.HierarchyPointNode<ParsedNode>;
				const target = d.target as d3.HierarchyPointNode<ParsedNode>;
				
				// Create path with right angles: horizontal then vertical
				// This creates the classic rectangular phylogenetic tree appearance
				return `M${source.y},${source.x}L${target.y},${source.x}L${target.y},${target.x}`;
			}

			// Create rectangular phylogenetic tree branches instead of curved ones
			g.selectAll<SVGPathElement, d3.HierarchyLink<ParsedNode>>(".link")
				.data(treeRoot.links())
				.enter()
				.append("path")
				.attr("class", "link")
				.attr("fill", "none")
				.attr("stroke", "#555")
				.attr("stroke-opacity", 0.6)
				.attr("stroke-width", 1.5)
				.attr("d", createRectangularPath);

			// Add nodes with improved styling
			const nodeEnter = g
				.selectAll<SVGGElement, d3.HierarchyPointNode<ParsedNode>>(".node")
				.data(treeRoot.descendants())
				.enter()
				.append("g")
				.attr(
					"class",
					(d) => `node ${d.children ? "node--internal" : "node--leaf"}`,
				)
				.attr("transform", (d) => `translate(${d.y},${d.x})`);

			// Internal nodes (branch points)
			nodeEnter
				.filter((d: d3.HierarchyPointNode<ParsedNode>) => !!d.children)
				.append("circle")
				.attr("r", 2.5)
				.attr("fill", "#333")
				.attr("stroke", "none")
				.attr("opacity", 0)
				.attr("transform", "scale(0)");

			// Leaf nodes (species/sequences)
			nodeEnter
				.filter((d: d3.HierarchyPointNode<ParsedNode>) => !d.children)
				.append("circle")
				.attr("r", 4)
				.attr("fill", "#2563eb")
				.attr("stroke", "#1d4ed8")
				.attr("stroke-width", 1.5)
				.attr("opacity", 0)
				.attr("transform", "scale(0)");

			// Labels for leaf nodes only (species names)
			nodeEnter
				.filter((d: d3.HierarchyPointNode<ParsedNode>) => !d.children && !!d.data.name)
				.append("text")
				.attr("dy", ".35em")
				.attr("x", 12)
				.attr("text-anchor", "start")
				.text((d) => d.data.name)
				.style("font-size", "12px")
				.style("font-family", "sans-serif")
				.style("font-weight", "500")
				.style("fill", "#374151")
				.style("opacity", 0);

			console.log("[D3TreeViewer] Rectangular phylogenetic tree rendered.");
		} catch (error) {
			console.error("[D3TreeViewer] Error rendering D3 tree:", error);
			svg.selectAll("g").remove();
			const textElement = svg
				.append("text")
				.attr("x", 10)
				.attr("y", 20)
				.text("Error rendering D3 tree. See console.");
			textElement.append("title").text("Error message: Rendering failed");
		}
	}, [newickString, width, height]);

	const [isVisible, setIsVisible] = useState(false);
	const [animationComplete, setAnimationComplete] = useState(false);

	useEffect(() => {
		if (newickString && svgRef.current && !animationComplete) {
			const tl = gsap.timeline({ delay: 0.3 });
			
			const paths = svgRef.current.querySelectorAll("path");
			tl.fromTo(paths, 
				{ 
					strokeDasharray: function(_i, el) { 
						const pathLength = (el as SVGPathElement).getTotalLength();
						return `${pathLength} ${pathLength}`;
					}, 
					strokeDashoffset: function(_i, el) { 
						return (el as SVGPathElement).getTotalLength();
					} 
				},
				{ strokeDashoffset: 0, duration: 1.5, ease: "power2.out", stagger: 0.02 }
			);
			
			const circles = svgRef.current.querySelectorAll("circle");
			tl.fromTo(circles, 
				{ scale: 0, opacity: 0 },
				{ scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)", stagger: 0.03 },
				"-=1"
			);
			
			const texts = svgRef.current.querySelectorAll("text");
			tl.fromTo(texts, 
				{ opacity: 0, x: -10 },
				{ opacity: 1, x: 0, duration: 0.8, ease: "power2.out", stagger: 0.03 },
				"-=0.8"
			).call(() => {
				setAnimationComplete(true);
				setIsVisible(true);
			});
		} else if (newickString && animationComplete) {
			setIsVisible(true);
		}
	}, [newickString, animationComplete]);

	return (
		<div className="w-full h-full overflow-auto bg-slate-100 border rounded-md phylogenetic-tree-container relative">
			<svg ref={svgRef} width={width} height={height}>
				<title>Phylogenetic Tree</title>
			</svg>
			
			{!isVisible && newickString && (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="tree-loader">
						<div className="pulse-circle"></div>
					</div>
				</div>
			)}
		</div>
	);
};

export default PhylogeneticTreeViewer;
