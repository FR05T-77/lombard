let products = {};

fetch("products.json")
    .then(res => res.json())
    .then(data => products = data);

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
        d.onclick=()=>{selectedProduct=p; qtyBox.style.display="block"; qtyBox.focus();}
        results.appendChild(d);
    });
}

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

// --- CART ---
function add(name,qty){
    qty=Number(qty);
    if(!qty) return;

    const buy = products[name].buy;
    const sell = products[name].sell;

    const r=cart.insertRow();

    r.insertCell().innerText=name;
    r.insertCell().innerText=qty;
    r.insertCell().innerText=buy;
    r.insertCell().innerText=buy*qty;

    r.dataset.sell = sell * qty;

    update();
}

function update(){
    let totalBuy = 0;
    [...cart.rows].forEach((r,i)=>{
        if(i===0)return;
        totalBuy += Number(r.cells[3].innerText);
    });
    total.innerText = totalBuy;
}

function resetCart(){
    cart.innerHTML=`<tr><th>Produkt</th><th>Ilość</th><th>Cena</th><th>Suma</th></tr>`;
    update();
}

// --- ACCEPT ---
function accept(){
    let items=[];
    let sellTotal=0;

    [...cart.rows].forEach((r,i)=>{
        if(i===0)return;

        items.push({
            name:r.cells[0].innerText,
            qty:r.cells[1].innerText,
            sum:r.cells[3].innerText
        });

        sellTotal += Number(r.dataset.sell);
    });

    if(items.length===0){
        showToast("Koszyk pusty");
        return;
    }

    const buyTotal = Number(total.innerText);

    navigator.clipboard.writeText(buyTotal);

    let data = JSON.parse(localStorage.getItem("h") || "[]");

    data.unshift({
        items,
        buyTotal,
        sellTotal,
        date:new Date().toLocaleString()
    });

    localStorage.setItem("h", JSON.stringify(data));

    sendToDiscord(items, buyTotal, sellTotal);

    renderHistory();
    resetCart();

    showToast("Zapisano: "+buyTotal+"$");
}

// --- HISTORY ---
function renderHistory(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    historyList.innerHTML="";

    data.forEach(t=>{
        const d=document.createElement("div");
        d.className="transaction";
        d.innerText=`${t.date} | Skup: ${t.buyTotal}$ | Lombard: ${t.sellTotal}$`;
        d.onclick=()=>openModal(t);
        historyList.appendChild(d);
    });
}

function resetHistory(){
    if(!confirm("Usunąć historię?")) return;
    localStorage.removeItem("h");
    renderHistory();
}

// --- MODAL ---
function openModal(t){
    modal.style.display="flex";

    let html="<h3>Transakcja</h3>";

    t.items.forEach(i=>{
        html+=`${i.name} x${i.qty} = ${i.sum}$<br>`;
    });

    html+=`<hr>Skup: ${t.buyTotal}$<br>Lombard: ${t.sellTotal}$`;

    modalContent.innerHTML=html;
}

modal.onclick=()=>modal.style.display="none";

// --- SETTINGS ---
settingsBtn.onclick = () => {
    settingsModal.style.display="flex";
    discordIdInput.value = localStorage.getItem("discordId") || "";
};

function saveSettings(){
    localStorage.setItem("discordId", discordIdInput.value.trim());
    settingsModal.style.display="none";
    showToast("Zapisano ID");
}

// --- DISCORD ---
async function sendToDiscord(items, buyTotal, sellTotal){
    const id = localStorage.getItem("discordId") || "";

    let content = id ? `<@${id}>\n` : "";
    content += "**Nowa transakcja:**\n";

    items.forEach(i=>{
        content += `• ${i.name} x${i.qty} = ${i.sum}$\n`;
    });

    content += `\n💰 Skup: ${buyTotal}$\n💸 Lombard: ${sellTotal}$`;

    try {
        await fetch("https://discord.com/api/webhooks/1485761128217837568/Y6UHCNADaxG0Y_OJ5KR2uwSjlZN9qBk5EDy_YZdfLtYfkn15YIyKDCZIWTX1wB2kS0eW", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ content })
        });
    } catch(e){}
}

// --- TOAST ---
function showToast(msg){
    toast.innerText=msg;
    toast.style.display="block";
    setTimeout(()=>toast.style.display="none",2000);
}

renderHistory();