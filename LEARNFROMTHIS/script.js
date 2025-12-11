// ==========================================
// TASK 1: Interactive Multi-Series Line Chart
// ==========================================
function drawTask1() {
    const margin = { top: 20, right: 100, bottom: 110, left: 40 };
    const margin2 = { top: 330, right: 100, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    const height2 = 400 - margin2.top - margin2.bottom;

    const svg = d3.select("#container1").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    svg.append("defs").append("clipPath").attr("id", "clip").append("rect").attr("width", width).attr("height", height);

    const focus = svg.append("g").attr("class", "focus").attr("transform", `translate(${margin.left},${margin.top})`);
    const context = svg.append("g").attr("class", "context").attr("transform", `translate(${margin2.left},${margin2.top})`);

    const x = d3.scaleTime().range([0, width]);
    const x2 = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);
    const y2 = d3.scaleLinear().range([height2, 0]);
    const color = d3.scaleOrdinal().range(['#e41a1c', '#377eb8', '#4daf4a']);

    const parseDate = d3.timeParse("%Y-%m-%d");

    d3.csv("Data/weather.csv", d => ({
        date: parseDate(d.date),
        temperature: +d.temperature,
        humidity: +d.humidity,
        wind: +d.wind
    })).then(data => {
        const keys = ["temperature", "humidity", "wind"];
        color.domain(keys);

        const categories = keys.map(name => ({
            name: name,
            values: data.map(d => ({ date: d.date, value: d[name] }))
        }));

        x.domain(d3.extent(data, d => d.date));
        y.domain([0, d3.max(categories, c => d3.max(c.values, v => v.value))]);
        x2.domain(x.domain());
        y2.domain(y.domain());

        const line = d3.line().x(d => x(d.date)).y(d => y(d.value));
        const line2 = d3.line().x(d => x2(d.date)).y(d => y2(d.value));

        const focusLines = focus.selectAll(".line")
            .data(categories).enter().append("path")
            .attr("class", "line")
            .attr("d", d => line(d.values))
            .style("stroke", d => color(d.name))
            .style("fill", "none").style("stroke-width", 2)
            .attr("clip-path", "url(#clip)")
            .attr("id", d => "line-" + d.name);

        focus.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        focus.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y));

        context.selectAll(".line")
            .data(categories).enter().append("path")
            .attr("d", d => line2(d.values))
            .style("stroke", d => color(d.name))
            .style("fill", "none").style("opacity", 0.5);

        context.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${height2})`).call(d3.axisBottom(x2).tickFormat(""));

        const brush = d3.brushX().extent([[0, 0], [width, height2]]).on("brush end", brushed);
        context.append("g").attr("class", "brush").call(brush).call(brush.move, x.range());

        function brushed(event) {
            if (event.sourceEvent && event.sourceEvent.type === "zoom") return;
            const s = event.selection || x2.range();
            x.domain(s.map(x2.invert, x2));
            focus.selectAll(".line").attr("d", d => line(d.values));
            focus.select(".axis--x").call(d3.axisBottom(x));
        }

        const legend = svg.selectAll(".legend")
            .data(categories).enter().append("g")
            .attr("transform", (d, i) => `translate(${width + 20}, ${i * 20 + 30})`)
            .style("cursor", "pointer")
            .on("click", function(e, d) {
                const active = d.active ? false : true;
                const newOpacity = active ? 0 : 1;
                d3.select("#line-" + d.name).transition().duration(300).style("opacity", newOpacity);
                d.active = active;
                d3.select(this).style("opacity", active ? 0.5 : 1);
            });

        legend.append("rect").attr("width", 10).attr("height", 10).style("fill", d => color(d.name));
        legend.append("text").attr("x", 15).attr("y", 10).text(d => d.name);
    });
}

// ==========================================
// TASK 2: Force-Directed Graph (FIXED FREEZE & HIGHLIGHT)
// ==========================================
function drawTask2() {
    const width = 800, height = 500;
    const svg = d3.select("#container2").append("svg").attr("width", width).attr("height", height);
    
    // Border
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "none").attr("stroke", "#ccc");

    d3.json("Data/network.json").then(data => {
        const radius = 10;
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // Consistent color scale

        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g")
            .selectAll("line").data(data.links).join("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 2);

        const node = svg.append("g")
            .selectAll("circle").data(data.nodes).join("circle")
            .attr("r", radius)
            .attr("fill", d => colorScale(d.group))
            .attr("stroke", "#fff").attr("stroke-width", 1.5)
            .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

        node.append("title").text(d => d.id);

        // --- INTERACTIONS ---
        
        // Hover Logic
        node.on("mouseover", function(event, d) {
            // Dim all
            node.style("opacity", 0.1);
            link.style("stroke-opacity", 0.1);

            // Highlight Self
            d3.select(this).style("opacity", 1).attr("stroke", "black").attr("stroke-width", 3);

            // Highlight Neighbors
            const connectedNodeIds = new Set();
            link.filter(l => l.source.id === d.id || l.target.id === d.id)
                .style("stroke-opacity", 1)
                .style("stroke", "red")
                .style("stroke-width", 3)
                .each(l => {
                    connectedNodeIds.add(l.source.id);
                    connectedNodeIds.add(l.target.id);
                });

            node.filter(n => connectedNodeIds.has(n.id)).style("opacity", 1);
        })
        .on("mouseout", function(event, d) {
            // Restore Defaults
            node.style("opacity", 1);
            link.style("stroke-opacity", 0.6).style("stroke", "#999").style("stroke-width", 2);
            
            // FIX: Restore stroke based on Frozen State (fx)
            // If frozen, keep black border. If floating, white border.
            node.attr("stroke", n => (n.fx !== null && n.fx !== undefined) ? "black" : "#fff")
                .attr("stroke-width", n => (n.fx !== null && n.fx !== undefined) ? 3 : 1.5);
        });

        // Click Logic (Freeze/Unfreeze)
        node.on("click", (event, d) => {
            if (d.fx === null || d.fx === undefined) {
                // FREEZE
                d.fx = d.x; d.fy = d.y;
                d3.select(event.target).attr("stroke", "black").attr("stroke-width", 3);
            } else {
                // UNFREEZE
                d.fx = null; d.fy = null;
                d3.select(event.target).attr("stroke", "#fff").attr("stroke-width", 1.5);
            }
        });

        // Tick Function (with Boundaries)
        simulation.on("tick", () => {
            node
                .attr("cx", d => d.x = Math.max(radius, Math.min(width - radius, d.x)))
                .attr("cy", d => d.y = Math.max(radius, Math.min(height - radius, d.y)));

            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
        });

        // Drag Functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
            
            // FIX: Visually update to "Frozen" style immediately
            d3.select(this).attr("stroke", "black").attr("stroke-width", 3);
        }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); }
    });
}

// ==========================================
// TASK 3: Zoomable Treemap (FIXED SEARCH & ZOOM)
// ==========================================
let searchNode; 

function drawTask3() {
    const width = 800, height = 500;
    const svg = d3.select("#container3").append("svg").attr("width", width).attr("height", height);
    
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => group.attr("transform", event.transform));

    svg.call(zoom);
    
    const group = svg.append("g");

    d3.json("Data/software.json").then(data => {
        const root = d3.hierarchy(data).sum(d => d.value || 1).sort((a, b) => b.value - a.value);
        
        d3.treemap().size([width, height]).paddingInner(1)(root);

        const nodes = group.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        nodes.append("rect")
            .attr("id", d => "node-" + d.data.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", d => d3.interpolateCool(d.parent.data.name.length / 10))
            .attr("stroke", "white");

        nodes.append("text")
            .attr("x", 3).attr("y", 13)
            .text(d => d.data.name)
            .style("font-size", "10px").style("fill", "white")
            .style("pointer-events", "none");

        nodes.append("title").text(d => `${d.ancestors().reverse().map(a => a.data.name).join("/")}`);

        searchNode = function() {
            const inputVal = document.getElementById("searchBox").value;
            if (!inputVal) return;
            
            const term = inputVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const match = root.leaves().find(d => d.data.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(term));

            if (match) {
                // Breadcrumbs
                const path = match.ancestors().reverse().map(d => d.data.name).join(" > ");
                document.getElementById("breadcrumbs").innerText = path;

                // Highlight
                d3.selectAll("rect").attr("stroke", "white").attr("stroke-width", 1).style("opacity", 0.6);
                
                const targetID = "#node-" + match.data.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const targetRect = d3.select(targetID);

                targetRect
                    .style("opacity", 1)
                    .transition().duration(200)
                    .attr("fill", "red")
                    .attr("stroke", "yellow").attr("stroke-width", 5)
                    .transition().duration(1000)
                    .attr("fill", d3.interpolateCool(match.parent.data.name.length / 10));

                // Auto-Zoom
                const x0 = match.x0, x1 = match.x1;
                const y0 = match.y0, y1 = match.y1;
                const nodeCenterX = (x0 + x1) / 2;
                const nodeCenterY = (y0 + y1) / 2;
                const k = 4; // Zoom level
                
                const t = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(k)
                    .translate(-nodeCenterX, -nodeCenterY);

                svg.transition().duration(750).call(zoom.transform, t);

            } else {
                alert("Node not found! Try a different name.");
            }
        };
    });
}

// ==========================================
// TASK 4: Real-Time Dashboard
// ==========================================
function drawTask4() {
    let isRunning = true;
    let threshold = 50;
    let lineData = []; 
    const maxHistory = 50;

    document.getElementById("toggleStream").addEventListener("click", function() {
        isRunning = !isRunning;
        this.innerText = isRunning ? "Pause Stream" : "Resume Stream";
    });
    document.getElementById("thresholdSlider").addEventListener("input", function() {
        threshold = +this.value;
        document.getElementById("threshVal").innerText = threshold;
        updateBarColors();
    });

    const marginA = { top: 20, right: 20, bottom: 30, left: 40 };
    const widthA = 400 - marginA.left - marginA.right;
    const heightA = 200 - marginA.top - marginA.bottom;
    
    const svgA = d3.select("#chartA").append("svg").attr("width", 400).attr("height", 200)
        .append("g").attr("transform", `translate(${marginA.left},${marginA.top})`);
    
    const xA = d3.scaleBand().range([0, widthA]).padding(0.1);
    const yA = d3.scaleLinear().range([heightA, 0]);
    
    svgA.append("g").attr("class", "axis-x").attr("transform", `translate(0,${heightA})`);
    svgA.append("g").attr("class", "axis-y");

    const marginB = { top: 20, right: 20, bottom: 30, left: 40 };
    const widthB = 400 - marginB.left - marginB.right;
    const heightB = 200 - marginB.top - marginB.bottom;

    const svgB = d3.select("#chartB").append("svg").attr("width", 400).attr("height", 200)
        .append("g").attr("transform", `translate(${marginB.left},${marginB.top})`);
    
    svgB.append("defs").append("clipPath").attr("id", "clipB").append("rect").attr("width", widthB).attr("height", heightB);
    
    const xB = d3.scaleLinear().range([0, widthB]).domain([0, maxHistory - 1]);
    const yB = d3.scaleLinear().range([heightB, 0]).domain([0, 100]);
    
    svgB.append("g").attr("transform", `translate(0,${heightB})`).call(d3.axisBottom(xB).ticks(0)); 
    svgB.append("g").call(d3.axisLeft(yB).ticks(5));

    const linePath = svgB.append("path")
        .attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 2)
        .attr("clip-path", "url(#clipB)");

    const lineGen = d3.line().x((d, i) => xB(i)).y(d => yB(d.value)).curve(d3.curveBasis);

    function generateData() {
        return Array.from({ length: 10 }, () => ({
            id: crypto.randomUUID(),
            value: Math.random() * 100
        }));
    }

    function update() {
        if (!isRunning) return;

        const data = generateData(); 
        const newDataPoint = { value: Math.random() * 100 }; 
        
        // Chart A Update
        data.sort((a, b) => b.value - a.value);
        xA.domain(data.map(d => d.id));
        yA.domain([0, 100]);

        svgA.select(".axis-y").transition().duration(500).call(d3.axisLeft(yA));
        
        const bars = svgA.selectAll(".bar").data(data, d => d.id);

        bars.exit()
            .transition().duration(500)
            .attr("y", heightA).attr("height", 0).style("opacity", 0).remove();

        bars.transition().duration(500)
            .attr("x", d => xA(d.id))
            .attr("width", xA.bandwidth())
            .attr("y", d => yA(d.value))
            .attr("height", d => heightA - yA(d.value))
            .attr("fill", d => d.value > threshold ? "red" : "steelblue");

        bars.enter().append("rect")
            .attr("class", "bar")
            .attr("x", widthA)
            .attr("y", d => yA(d.value))
            .attr("width", xA.bandwidth())
            .attr("height", d => heightA - yA(d.value))
            .attr("fill", d => d.value > threshold ? "red" : "steelblue")
            .transition().duration(500)
            .attr("x", d => xA(d.id));

        // Chart B Update
        lineData.push(newDataPoint);
        if (lineData.length > maxHistory) lineData.shift();

        linePath.datum(lineData)
            .attr("d", lineGen)
            .attr("transform", null)
            .transition().duration(500).ease(d3.easeLinear);
    }

    window.updateBarColors = function() {
        svgA.selectAll(".bar").attr("fill", d => d.value > threshold ? "red" : "steelblue");
    }

    setInterval(update, 2000);
}

drawTask1();
drawTask2();
drawTask3();
drawTask4();