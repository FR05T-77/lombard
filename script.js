let products = {};
let commissions = {};

// 🔥 SHIFT STATE
let shiftActive = false;
let startTime = null;
let clockInterval = null;

fetch("products.json")
.then(res=>res.json())
.then(data=>products=data);

fetch("commissions.json")
.then(res=>res.json())
.then(data=>{
    commissions = data;
    loadRoles();
});

// --- SHIFT START ---
function startShift(){
    const money = startMoney.value;
    const discordId = localStorage.getItem("discordId");
    const role = localStorage.getItem("role");

    if(!money){
        showToast("Podaj środki");
        return;
    }

    if(!discordId){
        showToast("Ustaw Discord ID");
        return;
    }

    if(!role){
        showToast("Wybierz rangę");
        return;
    }

    shiftActive = true;
    startTime = Date.now();

    startModal.style.display = "none";
    clock.style.display = "block";

    startClock();
}

function startClock(){
    clockInterval = setInterval(()=>{
        const diff = Date.now() - startTime;

        const h = String(Math.floor(diff/3600000)).padStart(2,"0");
        const m = String(Math.floor(diff/60000)%60).padStart(2,"0");
        const s = String(Math.floor(diff/1000)%60).padStart(2,"0");

        clock.innerText = `${h}:${m}:${s}`;
    },1000);
}

// --- SETTINGS ---
settingsBtn.onclick = ()=>{
    settingsModal.style.display = "flex";
    discordIdInput.value = localStorage.getItem("discordId") || "";
    roleSelect.value = localStorage.getItem("role") || "";
};

function loadRoles(){
    roleSelect.innerHTML = "";

    Object.keys(commissions).forEach(role=>{
        const opt = document.createElement("option");
        opt.value = role;
        opt.innerText = `${role} (${commissions[role]}%)`;
        roleSelect.appendChild(opt);
    });

    const savedRole = localStorage.getItem("role");
    if(savedRole){
        roleSelect.value = savedRole;
    }
}

function saveSettings(){
    localStorage.setItem("discordId", discordIdInput.value.trim());
    localStorage.setItem("role", roleSelect.value);
    settingsModal.style.display = "none";
    showToast("Zapisano ustawienia");
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
    let totalSell = 0;

    [...cart.rows].forEach((r,i)=>{
        if(i===0) return;
        totalBuy += Number(r.cells[3].innerText);
        totalSell += Number(r.dataset.sell);
    });

    buyTotal.innerText = totalBuy;
    sellTotal.innerText = totalSell;

    customPrice.value = totalBuy;
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

    // 🔥 BLOKADA BEZ ZMIANY
    if(!shiftActive){
        showToast("Najpierw rozpocznij zmianę");
        return;
    }

    let list = "";
    let items = [];

    [...cart.rows].forEach((r,i)=>{
        if(i===0) return;

        const name = r.cells[0].innerText;
        const qty = Number(r.cells[1].innerText);

        list += `• ${name} x${qty}\n`;
        items.push({ name, qty });
    });

    if(!list){
        showToast("Koszyk pusty");
        return;
    }

    const buy = Number(buyTotal.innerText);
    const sell = Number(sellTotal.innerText);
    const custom = Number(customPrice.value);

    if(!custom){
        showToast("Podaj cenę");
        return;
    }

    if(custom > sell){
        showToast("Cena > lombard!");
        return;
    }

    const profit = sell - custom;
    const negotiation = custom - buy;

    try {
        await sendTransactionWebhook({
            list,
            buy,
            sell,
            custom,
            negotiation,
            profit,
            commissions
        });

        navigator.clipboard.writeText(custom.toString());

        let data = JSON.parse(localStorage.getItem("h") || "[]");

        data.push({
            items,
            buyTotal: buy,
            sellTotal: sell,
            final: custom,
            date: new Date().toLocaleString()
        });

        localStorage.setItem("h", JSON.stringify(data));

        renderHistory();
        resetCart();
        customPrice.value="";

        showToast("✔ Wysłano + skopiowano");

    } catch(err){
        console.error(err);
        showToast("❌ Błąd webhooka");
    }
}

// --- SHIFT ---
async function endShift(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    if(!data.length) return;

    await sendShiftWebhook({
        data,
        commissions
    });

    localStorage.removeItem("h");
    renderHistory();

    // 🔥 RESET ZMIANY
    clearInterval(clockInterval);
    clock.style.display = "none";
    startModal.style.display = "flex";
    shiftActive = false;

    showToast("Zmiana zakończona");
}

// --- HISTORY ---
function renderHistory(){
    const data = JSON.parse(localStorage.getItem("h") || "[]");
    historyList.innerHTML = "";

    data.forEach(t=>{
        const d = document.createElement("div");
        d.className = "transaction";

        d.innerHTML = `
            <strong>${t.date}</strong>
            <span>${t.final || t.sellTotal}$</span>
        `;

        d.onclick = ()=>{
            showDetails(t);
        };

        historyList.appendChild(d);
    });
}

// --- MODAL ---
function showDetails(t){
    let list = "";

    (t.items || []).forEach(i=>{
        list += `• ${i.name} x${i.qty}<br>`;
    });

    modalContent.innerHTML = `
        <div class="modal-box details">
            <h3>Szczegóły transakcji</h3>

            <div class="details-list">
                ${list || "Brak"}
            </div>

            <div class="details-total">
                💰 Skup: ${t.buyTotal}$<br>
                💸 Lombard: ${t.sellTotal}$<br>
                💵 Sprzedaż: ${t.final || t.sellTotal}$<br>
                📈 Zysk: ${(t.sellTotal - (t.final || t.sellTotal))}$
            </div>

            <br>
            <button onclick="modal.style.display='none'">Zamknij</button>
        </div>
    `;

    modal.style.display = "flex";
}

modal.onclick = (e)=>{
    if(e.target === modal){
        modal.style.display = "none";
    }
};

// --- TOAST ---
function showToast(msg){
    toast.innerText = msg;
    toast.classList.add("show");

    setTimeout(()=>{
        toast.classList.remove("show");
    },2000);
}

customPrice.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){
        accept();
        searchBox.focus();
    }
});

renderHistory();
