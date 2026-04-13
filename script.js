let products = {};
let commissions = {};

// 🔥 SHIFT STATE
let shiftActive = false;
let startTime = null;
let clockInterval = null;

// 🔥 FINANSE
let lombardCash = 0;
let workerCash = 0;
let shiftOwn = false;

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
async function startShift(){
    const money = Number(startMoney.value);
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

    shiftOwn = ownMoney.checked;

    shiftActive = true;
    startTime = Date.now();

    lombardCash = 0;
    workerCash = 0;

    // 🔥 STARTOWA KASA
    if(shiftOwn){
        workerCash = money;
    } else {
        lombardCash = money;
    }

    updateFinance();

    // 🔥 SAVE
    localStorage.setItem("shiftActive", "1");
    localStorage.setItem("shiftStart", startTime);
    localStorage.setItem("shiftMoney", money);
    localStorage.setItem("shiftOwn", shiftOwn ? "1" : "0");

    // 🔥 Ustaw datę startu tygodnia jeśli jeszcze nie ma
    if(!localStorage.getItem("weeklyStart")){
        localStorage.setItem("weeklyStart", new Date().toLocaleDateString("pl-PL"));
    }

    startModal.style.display = "none";
    clock.style.display = "block";

    startClock();

    // 🔥 AUTO-WYSYŁKA PODSUMOWANIA PRZY STARCIE ZMIANY
    const weeklyData = JSON.parse(localStorage.getItem("weekly") || "[]");
    if(weeklyData.length > 0){
        const fromDate = localStorage.getItem("weeklyStart") || "?";
        const toDate = new Date().toLocaleDateString("pl-PL");

        try {
            await sendWeeklyWebhook({ weeklyData, fromDate, toDate });
            showToast("📊 Wysłano aktualne podsumowanie tygodnia");
        } catch(err){
            console.error("Auto-weekly webhook error:", err);
        }
    }
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

// 🔥 UPDATE FINANSE
function updateFinance(){
    document.getElementById("lombardCash").innerText = lombardCash + "$";
    document.getElementById("workerCash").innerText = workerCash + "$";
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

    const tbody = cart.querySelector("tbody");
    const r = tbody.insertRow();

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

    const tbody = cart.querySelector("tbody");
    [...(tbody ? tbody.rows : [])].forEach(r=>{
        totalBuy += Number(r.cells[3].innerText);
        totalSell += Number(r.dataset.sell);
    });

    buyTotal.innerText = totalBuy;
    sellTotal.innerText = totalSell;

    customPrice.value = totalBuy;
}

function resetCart(){
    const tbody = cart.querySelector("tbody");
    if(tbody) tbody.innerHTML = "";
    update();
}

// --- ACCEPT ---
async function accept(){

    if(!shiftActive){
        showToast("Najpierw rozpocznij zmianę");
        return;
    }

    let list = "";
    let items = [];

    const tbody = cart.querySelector("tbody");
    [...(tbody ? tbody.rows : [])].forEach(r=>{
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

    // 🔥 PODZIAŁ KASY
    const role = localStorage.getItem("role");
    const percent = commissions[role] || 0;

    const workerGain = Math.round((profit * percent) / 100);
    const lombardGain = profit - workerGain;

    workerCash += workerGain;
    lombardCash += lombardGain;

    updateFinance();

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

    // 🔥 ZAPISZ ZMIANĘ DO TYGODNIOWYCH DANYCH
    saveShiftToWeekly(data);

    localStorage.removeItem("h");

    // 🔥 CLEAR SHIFT
    localStorage.removeItem("shiftActive");
    localStorage.removeItem("shiftStart");
    localStorage.removeItem("shiftMoney");
    localStorage.removeItem("shiftOwn");

    renderHistory();

    clearInterval(clockInterval);
    clock.style.display = "none";
    startModal.style.display = "flex";
    shiftActive = false;

    // 🔥 RESET KASY
    lombardCash = 0;
    workerCash = 0;
    updateFinance();

    showToast("Zmiana zakończona");
}

// 🔥 ZAPIS ZMIANY DO TYGODNIOWEGO MAGAZYNU
function saveShiftToWeekly(shiftTransactions){
    const role = localStorage.getItem("role");
    const discordId = localStorage.getItem("discordId");
    const percent = commissions[role] || 0;

    let totalBuy = 0, totalSell = 0, totalFinal = 0, totalProfit = 0, totalCommission = 0;
    let combinedItems = {};

    shiftTransactions.forEach(t => {
        totalBuy += t.buyTotal;
        totalSell += t.sellTotal;
        totalFinal += (t.final || t.sellTotal);

        const profitSingle = t.sellTotal - (t.final || t.sellTotal);
        totalCommission += Math.round((profitSingle * percent) / 100);

        (t.items || []).forEach(i => {
            combinedItems[i.name] = (combinedItems[i.name] || 0) + i.qty;
        });
    });

    totalProfit = totalSell - totalFinal;

    const shiftSummary = {
        discordId: discordId || "unknown",
        role: role || "Brak",
        date: new Date().toLocaleString("pl-PL"),
        totalBuy,
        totalSell,
        totalFinal,
        profit: totalProfit,
        commission: totalCommission,
        items: combinedItems
    };

    const weekly = JSON.parse(localStorage.getItem("weekly") || "[]");
    weekly.push(shiftSummary);
    localStorage.setItem("weekly", JSON.stringify(weekly));

    updateWeeklyCounter();
}

// 🔥 AKTUALIZACJA LICZNIKA ZMIAN W TYGODNIU
function updateWeeklyCounter(){
    const weekly = JSON.parse(localStorage.getItem("weekly") || "[]");
    const el = document.getElementById("weeklyCount");
    if(el) el.innerText = weekly.length;
}

// 🔥 WYŚLIJ TYGODNIOWE PODSUMOWANIE
async function sendWeeklySummary(){
    const weekly = JSON.parse(localStorage.getItem("weekly") || "[]");

    if(!weekly.length){
        showToast("Brak danych tygodniowych");
        return;
    }

    const fromDate = localStorage.getItem("weeklyStart") || "?";
    const toDate = new Date().toLocaleDateString("pl-PL");

    try {
        await sendWeeklyWebhook({ weeklyData: weekly, fromDate, toDate });

        // Potwierdź i zresetuj tydzień
        localStorage.removeItem("weekly");
        localStorage.removeItem("weeklyStart");

        updateWeeklyCounter();
        showToast("✔ Podsumowanie tygodniowe wysłane!");
    } catch(err){
        console.error(err);
        showToast("❌ Błąd wysyłania podsumowania");
    }
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

// 🔥 RESTORE SHIFT AFTER RELOAD
const savedShift = localStorage.getItem("shiftActive");
const savedStart = localStorage.getItem("shiftStart");
const savedOwn = localStorage.getItem("shiftOwn");
const savedMoney = Number(localStorage.getItem("shiftMoney") || 0);

if(savedShift && savedStart){
    shiftActive = true;
    startTime = Number(savedStart);
    shiftOwn = savedOwn === "1";

    lombardCash = 0;
    workerCash = 0;

    if(shiftOwn){
        workerCash = savedMoney;
    } else {
        lombardCash = savedMoney;
    }

    startModal.style.display = "none";
    clock.style.display = "block";

    startClock();
    updateFinance();
}

renderHistory();
updateWeeklyCounter();

// 🔥 AUTO-RESET TYGODNIOWEGO CACHE CO NIEDZIELĘ O 19:00
function checkWeeklyAutoReset(){
    const now = new Date();
    const isSundayAfter19 = now.getDay() === 0 && now.getHours() >= 19;

    if(!isSundayAfter19) return;

    // Sprawdź czy już czyściliśmy w tę niedzielę
    const lastReset = localStorage.getItem("weeklyLastReset");
    const thisWeekSunday = getThisSundayTimestamp();

    if(!lastReset || Number(lastReset) < thisWeekSunday){
        localStorage.removeItem("weekly");
        localStorage.removeItem("weeklyStart");
        localStorage.setItem("weeklyLastReset", Date.now().toString());
        updateWeeklyCounter();
        console.log("✔ Tygodniowy cache wyczyszczony automatycznie (niedziela 19:00)");
    }
}

function getThisSundayTimestamp(){
    const now = new Date();
    const day = now.getDay(); // 0 = niedziela
    const diff = day === 0 ? 0 : 7 - day;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + diff - (day === 0 ? 0 : 0));
    sunday.setHours(19, 0, 0, 0);
    return sunday.getTime();
}

checkWeeklyAutoReset();
