let products = {};

const WEBHOOK_TRANSACTION = "https://discord.com/api/webhooks/1485761128217837568/Y6UHCNADaxG0Y_OJ5KR2uwSjlZN9qBk5EDy_YZdfLtYfkn15YIyKDCZIWTX1wB2kS0eW";
const WEBHOOK_SHIFT = "https://discord.com/api/webhooks/1485770501107351562/ulmO4WHtRKKz7n0RMt9tkc6ZnHoZAlQyZIFTCuKk6BrXT0lhXiVXlpCNGUkaEDHaWhp7";

fetch("products.json")
.then(res=>res.json())
.then(data=>products=data);

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
    if(!filtered.length) return;

    if(e.key==="ArrowDown") selectedIndex=(selectedIndex+1)%filtered.length;
    if(e.key==="ArrowUp") selectedIndex=(selectedIndex-1+filtered.length)%filtered.length;

    if(e.key==="Enter"){
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

    // ❌ DELETE BUTTON
    const delCell = r.insertCell();
    const btn = document.createElement("button");
    btn.innerText = "❌";
    btn.className = "remove-btn";

    btn.onclick = () => {
        r.remove();
        update();
    };

    delCell.appendChild(btn);

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
        <th></th>
    </tr>`;
    update();
}

// --- ACCEPT ---
async function accept(){
    let list = "";
    let sellTotal = 0;
    let items = [];

    [...cart.rows].forEach((r,i)=>{
        if(i===0) return;

        const name = r.cells[0].innerText;
        const qty = Number(r.cells[1].innerText);

        list += `• ${name} x${qty}\n`;

        items.push({ name, qty });

        sellTotal += Number(r.dataset.sell);
    });

    if(!list){
        showToast("Koszyk pusty");
        return;
    }

    const buyTotal = Number(total.innerText);
    const profit = sellTotal - buyTotal;

    const discordId = localStorage.getItem("discordId");
    const userTag = discordId ? `<@${discordId}>` : "Brak";

    await fetch(WEBHOOK_TRANSACTION, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "Nowa transakcja",
                color: 0x2b2d31,
                description:
`👤 Pracownik: ${userTag}

📦 Przedmioty:
${list}

💰 Skup: ${buyTotal}$
💸 Lombard: ${sellTotal}$
📈 Zysk: ${profit}$`
            }]
        })
    });

    let data = JSON.parse(localStorage.getItem("h") || "[]");

    data.push({
        items,
        buyTotal,
        sellTotal,
        date: new Date().toLocaleString()
    });

    localStorage.setItem("h", JSON.stringify(data));

    renderHistory();
    resetCart();

    showToast("Wysłano na Discord");
}

// --- SHIFT ---
async function endShift(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    if(!data.length) return;

    let totalBuy = 0;
    let totalSell = 0;
    let combined = {};

    data.forEach(t=>{
        totalBuy += t.buyTotal;
        totalSell += t.sellTotal;

        (t.items || []).forEach(i=>{
            combined[i.name] = (combined[i.name] || 0) + i.qty;
        });
    });

    let list = "";
    Object.entries(combined).forEach(([name, qty])=>{
        list += `• ${name} x${qty}\n`;
    });

    const profit = totalSell - totalBuy;

    const discordId = localStorage.getItem("discordId");
    const userTag = discordId ? `<@${discordId}>` : "Brak";

    await fetch(WEBHOOK_SHIFT, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
            embeds: [{
                title: "Zakończenie zmiany",
                color: 0x000000,
                description:
`👤 Pracownik: ${userTag}

📦 Przedmioty:
${list || "Brak"}

💰 Skup: ${totalBuy}$
💸 Lombard: ${totalSell}$
📈 Zysk: ${profit}$`
            }]
        })
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
        d.innerText = `${t.date} | ${t.buyTotal}$`;
        historyList.appendChild(d);
    });
}

// --- TOAST ---
function showToast(msg){
    toast.innerText = msg;
    toast.classList.add("show");

    setTimeout(()=>{
        toast.classList.remove("show");
    },2000);
}

// INIT
renderHistory();
