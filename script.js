let products = {};

fetch("products.json")
.then(res=>res.json())
.then(data=>products=data);

// --- SEARCH ---
let filtered=[], selectedIndex=0, selectedProduct=null;

function openSearch(){
    searchBox.style.display="block";
    searchBox.focus();
}

searchBox.oninput=()=>{
    const v=searchBox.value.toLowerCase();
    filtered=Object.keys(products).filter(p=>p.toLowerCase().includes(v));
    selectedIndex=0;
    render();
};

searchBox.onkeydown=e=>{
    if(e.key==="ArrowDown") selectedIndex=(selectedIndex+1)%filtered.length;
    if(e.key==="ArrowUp") selectedIndex=(selectedIndex-1+filtered.length)%filtered.length;
    if(e.key==="Enter"){
        if(!filtered.length) return;
        selectedProduct=filtered[selectedIndex];
        qtyBox.style.display="block";
        qtyBox.focus();
    }
    render();
};

function render(){
    results.innerHTML="";
    filtered.forEach((p,i)=>{
        const d=document.createElement("div");
        d.className="result"+(i===selectedIndex?" selected":"");
        d.innerText=p+" — "+products[p].buy+"$";
        d.onclick=()=>{
            selectedProduct=p;
            qtyBox.style.display="block";
            qtyBox.focus();
        };
        results.appendChild(d);
    });
}

// --- CART ---
qtyBox.onkeydown=e=>{
    if(e.key==="Enter"){
        add(selectedProduct, qtyBox.value);
        qtyBox.value="";
        qtyBox.style.display="none";
        searchBox.value="";
        results.innerHTML="";
        searchBox.focus();
    }
};

function add(name,qty){
    qty = Number(qty);
    if(!qty) return;

    const buy = Number(products[name].buy);
    const sell = Number(products[name].sell);

    const r = cart.insertRow();

    r.insertCell().innerText = name;
    r.insertCell().innerText = qty;
    r.insertCell().innerText = buy;
    r.insertCell().innerText = buy * qty;

    r.dataset.sell = sell * qty;

    update();
}

function update(){
    let totalBuy = 0;

    [...cart.rows].forEach((r,i)=>{
        if(i===0) return;
        totalBuy += Number(r.cells[3].innerText);
    });

    total.innerText = totalBuy;
}

function resetCart(){
    cart.innerHTML = `
    <tr>
        <th>Produkt</th>
        <th>Ilość</th>
        <th>Cena</th>
        <th>Suma</th>
    </tr>`;
    update();
}

// --- ACCEPT ---
function accept(){
    let items = [];
    let sellTotal = 0;

    [...cart.rows].forEach((r,i)=>{
        if(i===0) return;

        items.push({
            name: r.cells[0].innerText,
            qty: Number(r.cells[1].innerText),
            sum: Number(r.cells[3].innerText)
        });

        sellTotal += Number(r.dataset.sell);
    });

    if(items.length === 0){
        showToast("Koszyk pusty");
        return;
    }

    const buyTotal = Number(total.innerText);

    navigator.clipboard.writeText(buyTotal);

    let data = JSON.parse(localStorage.getItem("h") || "[]");

    data.push({
        items,
        buyTotal,
        sellTotal,
        date: new Date().toLocaleString()
    });

    localStorage.setItem("h", JSON.stringify(data));

    resetCart();
    renderHistory();

    showToast("Zapisano: " + buyTotal + "$");
}

// --- SHIFT END ---
async function endShift(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    if(!data.length) return;

    let combined = {};
    let totalBuy = 0;
    let totalSell = 0;

    data.forEach(t=>{
        totalBuy += Number(t.buyTotal);
        totalSell += Number(t.sellTotal);

        t.items.forEach(i=>{
            combined[i.name] = (combined[i.name] || 0) + Number(i.qty);
        });
    });

    let list = "";

    Object.entries(combined).forEach(([name, qty])=>{
        list += `• ${name} x${qty}\n`;
    });

    const profit = totalSell - totalBuy;
    const discordId = localStorage.getItem("discordId") || "";

    const embed = {
        title: "Zakończenie zmiany",
        color: 0x000000,
        description:
`👤 Pracownik: ${discordId ? `<@${discordId}>` : "Brak"}

📦 Przedmioty:
${list}

💰 Skup: ${totalBuy}$
💸 Lombard: ${totalSell}$
📈 Zysk: ${profit}$`
    };

    await fetch("https://discord.com/api/webhooks/1485770501107351562/ulmO4WHtRKKz7n0RMt9tkc6ZnHoZAlQyZIFTCuKk6BrXT0lhXiVXlpCNGUkaEDHaWhp7", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ embeds:[embed] })
    });

    localStorage.removeItem("h");
    renderHistory();

    showToast("Zmiana zakończona");
}

// --- HISTORY ---
function renderHistory(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    historyList.innerHTML = "";

    data.forEach(t=>{
        const d = document.createElement("div");
        d.className = "transaction";
        d.innerText = `${t.date} | Skup: ${t.buyTotal}$ | Lombard: ${t.sellTotal}$`;
        historyList.appendChild(d);
    });
}

// --- SETTINGS ---
settingsBtn.onclick = ()=>{
    settingsModal.style.display = "flex";
    discordIdInput.value = localStorage.getItem("discordId") || "";
};

function saveSettings(){
    localStorage.setItem("discordId", discordIdInput.value.trim());
    settingsModal.style.display = "none";
    showToast("Zapisano ID");
}

// --- TOAST ---
function showToast(msg){
    toast.innerText = msg;
    toast.style.display = "block";
    setTimeout(()=>toast.style.display="none",2000);
}

// INIT
renderHistory();
