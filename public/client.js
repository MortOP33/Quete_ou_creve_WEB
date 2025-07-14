const socket = io();
let role = null;
let mort = false;
let sabotageEnCours = false;
let sabotageTryTimeout = null;
let partieCommencee = false;
let sabotageDuration = 40;
let sabotageCDValue = 60;
let sabotageDelayValue = 10;
let sabotageClickWindow = 1;
let sabotageBtnDisableTime = 1;
let assassinCooldownEnd = 0;
let assassinDelayEnd = 0;
let assassinShowTimerTimeout = null;
let assassinDelayShowTimeout = null;
let sabotagePreparing = false;
let endTriggered = false;
let lastDesamorcage = 0;
let isZombie = false;

const rolePage = document.getElementById('rolePage');
const maitrePage = document.getElementById('maitrePage');
const joueurPage = document.getElementById('joueurPage');
const btnMaitre = document.getElementById('btnMaitre');
const btnInnocent = document.getElementById('btnInnocent');
const btnAssassin = document.getElementById('btnAssassin');
const btnHacker = document.getElementById('btnHacker');
const btnNecro = document.getElementById('btnNecro');
const assassinsInput = document.getElementById('assassinsInput');
const innocentsInput = document.getElementById('innocentsInput');
const sabotageDurationInput = document.getElementById('sabotageDurationInput');
const sabotageCDInput = document.getElementById('sabotageCDInput');
const sabotageDelayInput = document.getElementById('sabotageDelayInput');
const zombiesToReleverInput = document.getElementById('zombiesToReleverInput');
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const maitreState = document.getElementById('maitreState');
const configPanel = document.getElementById('configPanel');
const suiviPanel = document.getElementById('suiviPanel');
const btnDead = document.getElementById('btnDead');
const btnZombie = document.getElementById('btnZombie');
const btnAction = document.getElementById('btnAction');
const timerBox = document.getElementById('timerBox');
const alertBox = document.getElementById('alertBox');
const roleInfo = document.getElementById('roleInfo');
const btnRetourMaitre = document.getElementById('btnRetourMaitre');
const btnRetourJoueur = document.getElementById('btnRetourJoueur');
const btnRoleToggle = document.getElementById('btnRoleToggle');
const audioInnocents = document.getElementById('audioInnocents');
const audioAssassins = document.getElementById('audioAssassins');
const audioHacker = document.getElementById('audioHacker');
const audioNecromancien = document.getElementById('audioNecromancien');
const audioSabotageUp = document.getElementById('audioSabotageUp');
const audioSabotageDown = document.getElementById('audioSabotageDown');
const confirmPopup = document.getElementById('confirmPopup');
const popupOk = document.getElementById('popupOk');
const popupCancel = document.getElementById('popupCancel');

function showTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  timerBox.textContent = `${m}:${s}`;
  timerBox.classList.remove('hidden');
}
function hideTimer() {
  timerBox.classList.add('hidden');
}
function showAlert(msg, color) {
  alertBox.textContent = msg;
  alertBox.style.background = color || "#da0037";
  alertBox.classList.remove('hidden');
}
function hideAlert() {
  alertBox.textContent = "";
  alertBox.classList.add('hidden');
}
function disableJoueurBtns() {
  btnDead.disabled = true;
  btnAction.disabled = true;
  btnZombie.disabled = true;
}
function enableJoueurBtns() {
  if (!mort && !isZombie && partieCommencee && !endTriggered) {
    btnDead.disabled = false;
    btnAction.disabled = false;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = true;
  } else if (endTriggered) {
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = false;
  } else {
    // Mort ou zombie en cours de partie
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = true;
  }
  btnRoleToggle.disabled = false;
}
function showConfirmPopup(cb) {
  confirmPopup.classList.remove('hidden');
  function cleanup() {
    confirmPopup.classList.add('hidden');
    popupOk.onclick = null;
    popupCancel.onclick = null;
  }
  popupOk.onclick = function() { cleanup(); cb(true); };
  popupCancel.onclick = function() { cleanup(); cb(false); };
}
function resetJoueurStateUI() {
  mort = false;
  sabotageEnCours = false;
  isZombie = false;
  btnDead.disabled = true;
  btnDead.classList.remove('hidden');
  btnZombie.classList.add('hidden');
  btnZombie.disabled = false;
  btnAction.disabled = true;
  btnAction.textContent = "Action";
  btnAction.className = "big-btn action-btn";
  btnAction.dataset.state = "action";
  roleInfo.classList.remove('visible');
  btnRoleToggle.textContent = "Afficher rôle";
  hideTimer();
  hideAlert();
  btnRetourJoueur.disabled = false;
  btnRoleToggle.disabled = false;
  assassinCooldownEnd = 0;
  assassinDelayEnd = 0;
  sabotagePreparing = false;
  endTriggered = false;
  lastDesamorcage = 0;
}
function enableJoueurReturnBtns() {
  btnRetourJoueur.disabled = false;
  btnRoleToggle.disabled = false;
}
function disableJoueurReturnBtns() {
  btnRetourJoueur.disabled = true;
  btnRoleToggle.disabled = false;
}
function setJoueurReturnBtnsState() {
  if (endTriggered) {
    enableJoueurReturnBtns();
  } else {
    disableJoueurReturnBtns();
  }
}
function enableMaitreReturnBtn() {
  btnRetourMaitre.disabled = false;
}
function disableMaitreReturnBtn() {
  btnRetourMaitre.disabled = true;
}
function setActionButtonForRole() {
  btnAction.disabled = mort || isZombie;
  if (role === "assassin" || role === "innocent" || role === "hacker" || role === "necromancien") {
    btnAction.textContent = "Action";
    btnAction.className = "big-btn action-btn";
  }
  btnAction.dataset.state = "action";
}

btnMaitre.onclick = function() {
  role = 'maitre';
  showPage('maitre');
  resetJoueurStateUI();
  configPanel.classList.remove('hidden');
  suiviPanel.classList.add('hidden');
  enableMaitreReturnBtn();
  socket.emit('setRole', { role: 'maitre' });
};
btnInnocent.onclick = function() {
  role = 'innocent';
  showPage('joueur');
  resetJoueurStateUI();
  setActionButtonForRole();
  socket.emit('setRole', { role: 'innocent' });
  setTimeout(() => enableJoueurBtns(), 150);
};
btnAssassin.onclick = function() {
  role = 'assassin';
  showPage('joueur');
  resetJoueurStateUI();
  setActionButtonForRole();
  socket.emit('setRole', { role: 'assassin' });
  setTimeout(() => enableJoueurBtns(), 150);
};
btnHacker.onclick = function() {
  role = 'hacker';
  showPage('joueur');
  resetJoueurStateUI();
  setActionButtonForRole();
  socket.emit('setRole', { role: 'hacker' });
  setTimeout(() => enableJoueurBtns(), 150);
};
btnNecro.onclick = function() {
  role = 'necromancien';
  showPage('joueur');
  resetJoueurStateUI();
  setActionButtonForRole();
  socket.emit('setRole', { role: 'necromancien' });
  setTimeout(() => enableJoueurBtns(), 150);
};
btnStart.onclick = function() {
  const assassins = parseInt(assassinsInput.value, 10) || 1;
  const innocents = parseInt(innocentsInput.value, 10) || 1;
  sabotageDuration = parseInt(sabotageDurationInput.value, 10) || 40;
  sabotageCDValue = parseInt(sabotageCDInput.value, 10) || 60;
  sabotageDelayValue = parseInt(sabotageDelayInput.value, 10) || 10;
  const zombiesToRelever = parseInt(zombiesToReleverInput.value, 10) || 2;
  socket.emit('start', {
    assassins, innocents,
    sabotageDuration, sabotageCD: sabotageCDValue, sabotageDelay: sabotageDelayValue,
    sabotageSyncWindow: 1,
    zombiesToRelever
  });
  configPanel.classList.add('hidden');
  suiviPanel.classList.remove('hidden');
  disableMaitreReturnBtn();
};
btnReset.onclick = function() {
  socket.emit('reset');
  configPanel.classList.remove('hidden');
  suiviPanel.classList.add('hidden');
  enableMaitreReturnBtn();
};
btnRetourMaitre.onclick = function() {
  showPage('role');
  role = null;
};
btnRetourJoueur.onclick = function() {
  showPage('role');
  role = null;
  resetJoueurStateUI();
};
btnRoleToggle.onclick = function() {
  if (!roleInfo.classList.contains('visible')) {
    if (role === "innocent") roleInfo.innerHTML = "Vous êtes Innocent 👤";
    else if (role === "assassin") roleInfo.innerHTML = "Vous êtes Assassin 🗡️";
    else if (role === "hacker") roleInfo.innerHTML = "Vous êtes Hacker 💻";
    else if (role === "necromancien") roleInfo.innerHTML = "Vous êtes Nécromancien ⚰️";
    else roleInfo.innerHTML = "";
    roleInfo.classList.add('visible');
    btnRoleToggle.textContent = "Masquer rôle";
  } else {
    roleInfo.classList.remove('visible');
    btnRoleToggle.textContent = "Afficher rôle";
  }
};
btnDead.onclick = function() {
  if (mort || endTriggered) return;
  mort = true;
  btnDead.classList.add('hidden');
  btnAction.disabled = true;
  setJoueurReturnBtnsState();
  btnZombie.classList.remove('hidden');
  btnZombie.disabled = false;
  socket.emit('dead', { role });
  showAlert("Tu es mort.");
  enableJoueurBtns();
};
btnZombie.onclick = function() {
  if (isZombie) return;
  isZombie = true;
  btnZombie.disabled = true;
  btnAction.disabled = true;
  socket.emit('zombie');
  showAlert("Tu es un zombie.");
  enableJoueurBtns();
};

btnAction.onclick = function() {
  if (mort || endTriggered || isZombie) return;
  if (role === "innocent" || role === "hacker") {
    showConfirmPopup((ok) => {
      if (!ok) return;
      btnAction.disabled = true;
      btnDead.disabled = true;
      setJoueurReturnBtnsState();
      socket.emit('innocents_win');
    });
  } else if (role === "assassin") {
    const now = Date.now();
    if (assassinCooldownEnd > now) {
      let sec = Math.ceil((assassinCooldownEnd - now)/1000);
      showTimer(sec);
      if (assassinShowTimerTimeout) clearTimeout(assassinShowTimerTimeout);
      assassinShowTimerTimeout = setTimeout(() => hideTimer(), 1000);
      return;
    }
    if (sabotagePreparing && assassinDelayEnd > now) {
      let sec = Math.ceil((assassinDelayEnd - now)/1000);
      showTimer(sec);
      if (assassinDelayShowTimeout) clearTimeout(assassinDelayShowTimeout);
      assassinDelayShowTimeout = setTimeout(() => hideTimer(), 1000);
      return;
    }
    sabotagePreparing = true;
    socket.emit('prepare_sabotage');
  } else if (role === "necromancien") {
    // Aucune action
  }
};

btnAction.addEventListener('click', function() {
  if(btnAction.dataset.state === "sabotage" && !btnAction.disabled && !mort && !isZombie && !endTriggered) {
    const now = Date.now();
    if (now - lastDesamorcage < 1000) return;
    lastDesamorcage = now;
    socket.emit('desamorcage');
  }
});

socket.on('state', (state) => {
  partieCommencee = state.started;
  if(role === 'maitre') {
    maitreState.textContent =
      `Assassins morts : ${state.assassinsDead}/${state.assassins} | Innocents morts : ${state.innocentsDead}/${state.innocents}`;
    if(!state.started) {
      configPanel.classList.remove('hidden');
      suiviPanel.classList.add('hidden');
      enableMaitreReturnBtn();
    } else {
      configPanel.classList.add('hidden');
      suiviPanel.classList.remove('hidden');
      btnReset.disabled = !!state.sabotage;
      disableMaitreReturnBtn();
    }
  } else if (role === 'innocent' || role === 'assassin' || role === 'hacker' || role === 'necromancien') {
    enableJoueurBtns();
  }
});

socket.on('sabotageStart', function({ duration }) {
  sabotageEnCours = true;
  btnAction.textContent = "Désamorcer";
  btnAction.className = "big-btn desamorce-btn";
  btnAction.dataset.state = "sabotage";
  btnDead.disabled = mort || isZombie;
  setJoueurReturnBtnsState();
  showTimer(duration);
  showAlert("Sabotage ! Deux joueurs doivent désamorcer ensemble.", "#f7b801");
  if (role !== "maitre") {
    try { audioSabotageUp.currentTime = 0; audioSabotageUp.play(); } catch(e){}
  }
  btnReset && (btnReset.disabled = true);
  sabotagePreparing = false;
  lastDesamorcage = 0;
});
socket.on('sabotageTimer', function({ seconds }) {
  showTimer(seconds);
});
socket.on('sabotageStopped', function() {
  sabotageEnCours = false;
  setActionButtonForRole();
  btnDead.disabled = mort || isZombie;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Sabotage désamorcé !", "#00818a");
  if (role === "assassin") {
    assassinCooldownEnd = Date.now() + sabotageCDValue * 1000;
    sabotagePreparing = false;
  }
  if (role !== "maitre") {
    try { audioSabotageDown.currentTime = 0; audioSabotageDown.play(); } catch(e){}
  }
  setTimeout(hideAlert, 2500);
  btnReset && (btnReset.disabled = false);
});
socket.on('sabotageFailed', function() {
  sabotageEnCours = false;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Sabotage réussi par les assassins ! Fin de partie.");
  if (role !== "maitre") {
    try { audioAssassins.currentTime = 0; audioAssassins.play(); } catch(e){}
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
  endTriggered = true;
});
socket.on('end', ({ winner }) => {
  sabotageEnCours = false;
  endTriggered = true;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  setJoueurReturnBtnsState();
  hideTimer();
  if(winner === 'innocents') {
    showAlert("Victoire des innocents !");
    if (role !== "maitre") {
      try { audioInnocents.currentTime = 0; audioInnocents.play(); } catch(e){}
    }
  } else {
    showAlert("Victoire des assassins !");
    if (role !== "maitre") {
      try { audioAssassins.currentTime = 0; audioAssassins.play(); } catch(e){}
    }
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
});
socket.on('necromancien_win', () => {
  sabotageEnCours = false;
  endTriggered = true;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Victoire du Nécromancien !");
  if (role !== "maitre") {
    try { audioNecromancien.currentTime = 0; audioNecromancien.play(); } catch(e){}
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
});
socket.on('sabotageDelay', ({delay}) => {
  const now = Date.now();
  sabotageDelayValue = delay;
  assassinDelayEnd = now + delay*1000;
  sabotagePreparing = true;
});
socket.on('reset', function() {
  showPage('role');
  resetJoueurStateUI();
  role = null;
  enableMaitreReturnBtn();
  endTriggered = false;
  sabotageEnCours = false;
});

function unlockAudio() {
  for (const a of [audioInnocents, audioAssassins, audioSabotageUp, audioSabotageDown, audioNecromancien]) {
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(()=>{});
  }
  document.removeEventListener('click', unlockAudio);
}
document.addEventListener('click', unlockAudio);

function showPage(page) {
  rolePage.classList.toggle('hidden', page !== 'role');
  maitrePage.classList.toggle('hidden', page !== 'maitre');
  joueurPage.classList.toggle('hidden', page !== 'joueur');
  document.getElementById('confirmPopup').classList.add('hidden');
}
showPage('role');
roleInfo.classList.remove('visible');
btnRoleToggle.textContent = "Afficher rôle";

// Génération du QR code avec l'URL actuelle
const currentURL = window.location.href;
new QRCode(document.getElementById("qrcode"), {
  text: currentURL,
  width: 128,
  height: 128,
  colorDark: "#000000",
  colorLight: "#ffffff",
  correctLevel: QRCode.CorrectLevel.H,
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log("SW enregistré"))
      .catch(err => console.error("SW erreur", err));
  });
}