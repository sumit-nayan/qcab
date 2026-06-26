// --- STATE MANAGEMENT ---
let masterSyllabus = { official_syllabus_topics: [] };
let pyqRepo = [];
let cart = []; 
let currentMode = "year-gs";

// --- DOM ELEMENTS ---
const tbody = document.querySelector("#questionsTable tbody");
const filtersDiv = document.getElementById("filters");
const cartItemsContainer = document.getElementById("cartItemsContainer");
const cartCountEl = document.getElementById("cartCount");
const cartMarksEl = document.getElementById("cartMarks");
const generateBtn = document.getElementById("generateQCABBtn");

// Wait for the HTML to fully load before doing anything
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Fetch JSONs
        const msResp = await fetch('./js/mastersyllabustopic.json');
        masterSyllabus = await msResp.json();
        
        const qResp = await fetch('./js/pyqrepository.json');
        const qData = await qResp.json();
        pyqRepo = qData.questions_repository || [];

        // 2. Load Cart from browser memory
        loadCart();

        // 3. Setup UI
        wireModeToggle();
        setupFilters();
        setupCustomQuestionForm();
        renderCart();
        
        // 4. Attach Generate Button securely
        if(generateBtn) {
            generateBtn.addEventListener("click", handleGenerateClick);
        }

    } catch (error) {
        console.error("Initialization error:", error);
        alert("Error loading databases. Check the console for details.");
    }
});

// --- CART LOGIC (Flipkart Style) ---
function loadCart() {
    try {
        const saved = localStorage.getItem("qcab_cart");
        if (saved) cart = JSON.parse(saved);
    } catch(e) { cart = []; }
}

function saveCart() {
    localStorage.setItem("qcab_cart", JSON.stringify(cart));
    renderCart();
    populateTable(); // Refresh the table so "Add" turns to "Remove"
}

function addToCart(question) {
    if (!cart.find(q => q.question_id === question.question_id)) {
        cart.push(question);
        saveCart();
    }
}

// Attach to window so inline onclick can find it
window.removeFromCart = function(questionId) {
    cart = cart.filter(q => q.question_id !== String(questionId));
    saveCart();
}

function renderCart() {
    cartItemsContainer.innerHTML = "";
    let totalMarks = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-cart-msg">Your cart is empty. Add questions to generate a QCAB.</p>`;
        generateBtn.disabled = true;
    } else {
        generateBtn.disabled = false;
        
        // Sort cart: 10 markers first, then 15, then 20
        cart.sort((a, b) => Number(a.marks) - Number(b.marks));

        cart.forEach((q) => {
            totalMarks += Number(q.marks);
            const item = document.createElement("div");
            item.className = "cart-item";
            item.innerHTML = `
                <div class="cart-item-details">
                    <div class="cart-item-meta">[${q.marks}M] | ${q.gs_paper} | ${q.year}</div>
                    <div>${q.question_text.substring(0, 80)}${q.question_text.length > 80 ? '...' : ''}</div>
                </div>
                <button class="btn-danger" onclick="removeFromCart('${q.question_id}')">X</button>
            `;
            cartItemsContainer.appendChild(item);
        });
    }

    cartCountEl.textContent = cart.length;
    cartMarksEl.textContent = totalMarks;
}

// --- CUSTOM QUESTION FORM (Dynamic Dropdown) ---
function setupCustomQuestionForm() {
    const gsSelect = document.getElementById("customGS");
    const topicSelect = document.getElementById("customTopic");

    // When GS changes, update the Topic dropdown dynamically
    gsSelect.addEventListener("change", () => {
        const selectedGS = gsSelect.value;
        topicSelect.innerHTML = '<option value="">Select Topic...</option>'; 
        
        if (!selectedGS) return;

        const topics = masterSyllabus.official_syllabus_topics.filter(t => t.gs_paper === selectedGS);
        
        topics.forEach(t => {
            topicSelect.add(new Option(t.description.substring(0, 70) + "...", t.id));
        });
    });

    // Add Custom Question to Cart
    document.getElementById("addCustomBtn").addEventListener("click", () => {
        const text = document.getElementById("customQText").value.trim();
        const gs = gsSelect.value;
        const topicId = topicSelect.value;
        const marks = document.getElementById("customMarks").value;

        if (!text || !gs || !topicId) {
            alert("Please fill in the Question text, select a GS Paper, and select a Topic.");
            return;
        }

        const newQ = {
            question_id: "CUSTOM_" + Date.now(),
            year: "Custom",
            gs_paper: gs,
            official_syllabus_topics: [topicId],
            question_text: text,
            marks: Number(marks),
            word_limit: marks == 10 ? 150 : 250
        };

        addToCart(newQ);
        document.getElementById("customQText").value = ""; // clear input
    });
}

// --- FILTER & TABLE LOGIC ---
function wireModeToggle() {
    document.querySelectorAll("input[name='mode']").forEach(radio => {
        radio.addEventListener("change", (e) => {
            currentMode = e.target.value;
            setupFilters();
        });
    });
}

function setupFilters() {
    filtersDiv.innerHTML = "";
    tbody.innerHTML = "";

    if (currentMode === "year-gs") {
        filtersDiv.innerHTML = `
            <select id="yearFilter"><option value="">-- Select Year --</option></select>
            <select id="gsFilter"><option value="">-- Select GS Paper --</option></select>
        `;
        const yearFilter = document.getElementById("yearFilter");
        const gsFilter = document.getElementById("gsFilter");

        const years = Array.from(new Set(pyqRepo.map(q => q.year))).sort((a,b)=>b-a);
        const gsPapers = Array.from(new Set(pyqRepo.map(q => q.gs_paper))).sort();

        years.forEach(y => yearFilter.add(new Option(y, y)));
        gsPapers.forEach(g => gsFilter.add(new Option(g, g)));

        yearFilter.addEventListener("change", populateTable);
        gsFilter.addEventListener("change", populateTable);

    } else {
        filtersDiv.innerHTML = `
            <select id="gsFilter"><option value="">-- Select GS Paper --</option></select>
            <select id="syllabusFilter"><option value="">-- Select Topic --</option></select>
        `;
        const gsFilter = document.getElementById("gsFilter");
        const syllabusFilter = document.getElementById("syllabusFilter");

        const gsPapers = Array.from(new Set(pyqRepo.map(q => q.gs_paper))).sort();
        gsPapers.forEach(g => gsFilter.add(new Option(g, g)));

        gsFilter.addEventListener("change", () => {
            syllabusFilter.innerHTML = "<option value=''>-- All Topics --</option>";
            const masterArr = masterSyllabus.official_syllabus_topics || [];
            masterArr.forEach(t => {
                if (t.gs_paper === gsFilter.value) {
                    syllabusFilter.add(new Option(t.description.substring(0, 60) + "...", t.id));
                }
            });
            populateTable();
        });
        
        syllabusFilter.addEventListener("change", populateTable);
    }
}

function populateTable() {
    tbody.innerHTML = "";
    let filtered = pyqRepo;

    const gsVal = document.getElementById("gsFilter")?.value;
    
    if (currentMode === "year-gs") {
        const yearVal = document.getElementById("yearFilter")?.value;
        if (!yearVal && !gsVal) return; 
        if (yearVal) filtered = filtered.filter(q => String(q.year) === String(yearVal));
        if (gsVal) filtered = filtered.filter(q => q.gs_paper === gsVal);
    } else {
        const topicVal = document.getElementById("syllabusFilter")?.value;
        if (!gsVal) return; 
        filtered = filtered.filter(q => q.gs_paper === gsVal);
        if (topicVal) {
            filtered = filtered.filter(q => q.official_syllabus_topics && q.official_syllabus_topics.includes(topicVal));
        }
    }

    filtered.forEach(q => {
        const tr = document.createElement("tr");
        const isInCart = cart.some(cartItem => cartItem.question_id === String(q.question_id));

        tr.innerHTML = `
            <td>${q.year}</td>
            <td>${q.gs_paper}</td>
            <td class="q-text">${q.question_text}</td>
            <td>${q.marks}</td>
            <td id="action_td_${q.question_id}"></td>
        `;
        tbody.appendChild(tr);

        const actionTd = document.getElementById(`action_td_${q.question_id}`);
        if (isInCart) {
            const btn = document.createElement("button");
            btn.className = "btn-danger";
            btn.textContent = "Remove";
            btn.onclick = () => removeFromCart(q.question_id);
            actionTd.appendChild(btn);
        } else {
            const btn = document.createElement("button");
            btn.className = "btn-outline";
            btn.textContent = "+ Add";
            btn.onclick = () => addToCart(q);
            actionTd.appendChild(btn);
        }
    });
}

// --- SINGLE BUTTON PDF GENERATION ---
function handleGenerateClick() {
    if (cart.length === 0) return;

    cart.sort((a, b) => Number(a.marks) - Number(b.marks));
    cart.forEach((q, index) => { q.question_number = index + 1; });

    generateAndDownloadQCABPDF(cart);
}

function generateAndDownloadQCABPDF(questions) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = 297, pageWidth = 210;
    const leftMargin = 25, rightMargin = 185, topMargin = 15, bottomMargin = 282;

    doc.setFont("Times", "Roman");

    // PART 1: Index Page
    let currentY = topMargin;
    doc.setFontSize(14);
    doc.text("QCAB - Question Index", leftMargin, currentY);
    currentY += 10;
    doc.setFontSize(12);

    questions.forEach((q) => {
        const qHeader = `Q${q.question_number}. `;
        const qText = `${q.question_text} [${q.marks}M | ${q.year}]`;
        const splitText = doc.splitTextToSize(qText, rightMargin - leftMargin - 5);
        const totalHeight = splitText.length * 6;

        if (currentY + totalHeight > pageHeight - 15) {
            doc.addPage();
            currentY = topMargin;
        }

        doc.text(qHeader, leftMargin - 10, currentY);
        doc.text(splitText, leftMargin, currentY);
        currentY += totalHeight + 4; 
    });

    // PART 2: Answer Booklet Pages
    questions.forEach((q) => {
        const pagesNeeded = Math.ceil(Number(q.marks) / 5);

        for (let p = 0; p < pagesNeeded; p++) {
            doc.addPage();
            doc.setLineWidth(0.3);
            doc.line(leftMargin, topMargin, leftMargin, bottomMargin);
            doc.line(rightMargin, topMargin, rightMargin, bottomMargin);

            doc.setFontSize(8);
            doc.text(`ID: ${q.question_id}`, leftMargin - 10, bottomMargin + 3);

            if (p === 0) {
                doc.setFontSize(12);
                doc.text(`Q. ${q.question_number}`, leftMargin - 15, topMargin + 5);
                const splitText = doc.splitTextToSize(`${q.question_text}`, rightMargin - leftMargin - 4);
                doc.text(splitText, leftMargin + 2, topMargin + 5);
                doc.text(`${q.marks} M`, rightMargin + 2, topMargin + 5);
            } else {
                const splitText = doc.splitTextToSize("Candidates must not write on this margin", 20);
                doc.text(splitText, rightMargin + 2, topMargin + 5);
            }
        }
    });

    doc.save("UPSC_Mains_Custom_QCAB.pdf");
}
