let products = {};

fetch("products.json")
.then(res=>res.json())
.then(data=>products=data);

let filtered=[], selectedIndex=0, selectedProduct=null;

// --- SEARCH ---
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

// --- CART ---
qtyBox.onkeydown=e=>{
    if(e.key==="Enter"){
        add(selectedProduct, qtyBox.value);
        qtyBox.value="";
        qtyBox.style.display="none";
        searchBox.value="";
        results.innerHTML="";
    }
};

function add(name,qty){
    qty=Number(qty);
    const r=cart.insertRow();

    r.insertCell().innerText=name;
    r.insertCell().innerText=qty;
    r.insertCell().innerText=products[name].buy;
    r.insertCell().innerText=products[name].buy*qty;

    r.dataset.sell = products[name].sell * qty;

    update();
}

function update(){
    let totalBuy=0;
    [...cart.rows].forEach((r,i)=>{
        if(i===0)return;
        totalBuy+=Number(r.cells[3].innerText);
    });
    total.innerText=totalBuy;
}

// --- ACCEPT ---
function accept(){
    let items=[];
    let sellTotal=0;

    [...cart.rows].forEach((r,i)=>{
        if(i===0)return;

        items.push({
            name:r.cells[0].innerText,
            qty:Number(r.cells[1].innerText),
            sum:Number(r.cells[3].innerText)
        });

        sellTotal+=Number(r.dataset.sell);
    });

    const buyTotal=Number(total.innerText);

    let data=JSON.parse(localStorage.getItem("h")||"[]");
    data.push({items,buyTotal,sellTotal});
    localStorage.setItem("h",JSON.stringify(data));

    resetCart();
    renderHistory();
}

// --- SHIFT END ---
async function endShift(){
    const data = JSON.parse(localStorage.getItem("h")||"[]");
    if(!data.length) return;

    let combined = {};
    let totalBuy=0;
    let totalSell=0;

    data.forEach(t=>{
        totalBuy+=t.buyTotal;
        totalSell+=t.sellTotal;

        t.items.forEach(i=>{
            if(!combined[i.name]) combined[i.name]=0;
            combined[i.name]+=i.qty;
        });
    });

    let list="";
    for(let name in combined){
        list += `${name} x${combined[name]}\n`;
    }

    const profit = totalSell - totalBuy;
    const discordId = localStorage.getItem("discordId")||"";

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
}

// --- HISTORY ---
function renderHistory(){
    const data=JSON.parse(localStorage.getItem("h")||"[]");
    historyList.innerHTML="";
    data.forEach(t=>{
        const d=document.createElement("div");
        d.className="transaction";
        d.innerText=`Skup: ${t.buyTotal}$ | Lombard: ${t.sellTotal}$`;
        historyList.appendChild(d);
    });
}

// --- SETTINGS ---
settingsBtn.onclick=()=>{
    settingsModal.style.display="flex";
    discordIdInput.value=localStorage.getItem("discordId")||"";
};

function saveSettings(){
    localStorage.setItem("discordId",discordIdInput.value);
    settingsModal.style.display="none";
}

renderHistory();
