const socket = io();
let role = null;
let mort = false;
let sabotageEnCours = false;
let sabotageTryTimeout = null;
let panneEnCours = false;
let panneTryTimeout = null;
let partieCommencee = false;
let sabotageDuration = 40;
let sabotageCDValue = 60;
let debuffDelayValue = 10;
let sabotageClickWindow = 1;
let sabotageBtnDisableTime = 1;
let panneDuration = 20;
let panneCDValue = 90;
let hackDuration = 60;
let hackCDValue = 90;
let hackdebuffDelayValue = 10;
let assassinCooldownSabotageEnd = 0;
let assassinCooldownPanneEnd = 0;
let assassinDelayEnd = 0;
let assassinShowTimerSabotageTimeout = null;
let assassinShowTimerPanneTimeout = null;
let assassinDelayShowTimeout = null;
let sabotagePreparing = false;
let pannePreparing = false;
let endTriggered = false;
let lastDesamorcage = 0;
let isZombie = false;
let alertTimeoutId = null;
let hackCooldownEnd = 0;
let hackerShowTimerTimeout = null;
let hackerDelayShowTimeout = null;
let hackPreparing = false;
let hackerDelayEnd = 0;
let isHacked = false;
let hackedTimerEnd = 0;
let hackedTimerInterval = null;

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
const debuffDelayInput = document.getElementById('debuffDelayInput');
const panneDurationInput = document.getElementById('panneDurationInput');
const panneCDInput = document.getElementById('panneCDInput');
const hackDurationInput = document.getElementById('hackDurationInput');
const hackCDInput = document.getElementById('hackCDInput');
const hackdebuffDelayInput = document.getElementById('debuffDelayInput');
const zombiesToReleverInput = document.getElementById('zombiesToReleverInput');
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const maitreState = document.getElementById('maitreState');
const configPanel = document.getElementById('configPanel');
const suiviPanel = document.getElementById('suiviPanel');
const btnDead = document.getElementById('btnDead');
const btnHack = document.getElementById('btnHack');
const btnZombie = document.getElementById('btnZombie');
const btnAction = document.getElementById('btnAction');
const timerBox = document.getElementById('timerBox');
const roleInfo = document.getElementById('roleInfo');
const btnRetourMaitre = document.getElementById('btnRetourMaitre');
const btnRetourJoueur = document.getElementById('btnRetourJoueur');
const btnRoleToggle = document.getElementById('btnRoleToggle');
const audioDebutPartie = document.getElementById('audioDebutPartie');
const audioInnocents = document.getElementById('audioInnocents');
const audioAssassins = document.getElementById('audioAssassins');
const audioHacker = document.getElementById('audioHacker');
const audioNecromancien = document.getElementById('audioNecromancien');
const audioSabotageUp = document.getElementById('audioSabotageUp');
const audioSabotageDown = document.getElementById('audioSabotageDown');
const audioPanneUp = document.getElementById('audioPanneUp');
const audioPanneDown = document.getElementById('audioPanneDown');
const confirmPopup = document.getElementById('confirmPopup');
const popupOk = document.getElementById('popupOk');
const popupCancel = document.getElementById('popupCancel');
const assassinActionPopup = document.getElementById('assassinActionPopup');
const popupAssassinBombe = document.getElementById('popupAssassinBombe');
const popupAssassinPanne = document.getElementById('popupAssassinPanne');
const popupAssassinCancel = document.getElementById('popupAssassinCancel');
const hackerPopup = document.getElementById('hackerPopup');

function showTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  timerBox.textContent = `${m}:${s}`;
  timerBox.classList.remove('hidden');
}
function hideTimer() {
  timerBox.classList.add('hidden');
}
function showAlert(msg, color, duration=2000) {
  const alertDiv = document.getElementById('alertDiv');
  alertDiv.textContent = msg;
  alertDiv.style.background = color || "#da0037";
  alertDiv.classList.remove('hidden');
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
    alertTimeoutId = null;
  }
  alertTimeoutId = setTimeout(hideAlert, duration);
}
function hideAlert() {
  const alertDiv = document.getElementById('alertDiv');
  if (!alertDiv) return;
  alertDiv.textContent = "";
  alertDiv.classList.add('hidden');
}

function enableJoueurBtns() {
  if (!mort && !isZombie && partieCommencee && !endTriggered) {
    btnDead.disabled = false;
    btnAction.disabled = false;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = false;
  } else if (isZombie && partieCommencee && !endTriggered) {
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = true;
  } else if (mort && partieCommencee && !endTriggered) {
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = false;
    btnRetourJoueur.disabled = true;
  } else if (!partieCommencee && !endTriggered) {
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = false;
  } else if (endTriggered) {
    btnDead.disabled = true;
    btnAction.disabled = true;
    btnZombie.disabled = true;
    btnRetourJoueur.disabled = false;
  }
  btnRoleToggle.disabled = false;
}

function showConfirmPopup(cb, message = "Valider les quêtes ?") {
  confirmPopup.classList.remove('hidden');
  document.getElementById('popupMessage').textContent = message;
  function cleanup() {
    confirmPopup.classList.add('hidden');
    popupOk.onclick = null;
    popupCancel.onclick = null;
  }
  popupOk.onclick = function() { cleanup(); cb(true); };
  popupCancel.onclick = function() { cleanup(); cb(false); };
}
function showAssassinActionPopup({ onBombe, onPanne, onCancel }) {
  assassinActionPopup.classList.remove('hidden');
  popupAssassinBombe.onclick = function() {
    assassinActionPopup.classList.add('hidden');
    if (onBombe) onBombe();
    cleanup();
  };
  popupAssassinPanne.onclick = function() {
    assassinActionPopup.classList.add('hidden');
    if (onPanne) onPanne();
    cleanup();
  };
  popupAssassinCancel.onclick = function() {
    assassinActionPopup.classList.add('hidden');
    if (onCancel) onCancel();
    cleanup();
  };
  function cleanup() {
    popupAssassinBombe.onclick = null;
    popupAssassinPanne.onclick = null;
    popupAssassinCancel.onclick = null;
  }
}
function showHackerPopup({ onSelect, onCancel }) {
  const btnRow = hackerPopup.querySelector('.popup-btn-row');
  btnRow.innerHTML = '';
  btnRow.style.display = "flex";
  btnRow.style.flexDirection = "column";
   let joueursAffichables = joueursState.filter(j =>
    (['innocent', 'assassin', 'hacker', 'necromancien'].includes(j.role)) &&
    j.id !== socket.id &&
    j.pseudo &&
    !j.mort &&
    !j.zombie
  );
  joueursAffichables = joueursAffichables
    .map(j => ({ ...j, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(j => { const { sort, ...rest } = j; return rest; })
    .slice(0, 4);
  for (let i = 0; i < joueursAffichables.length; i += 2) {
    const lineDiv = document.createElement('div');
    lineDiv.style.display = "flex";
    lineDiv.style.flexDirection = "row";
    lineDiv.style.justifyContent = "center";
    lineDiv.style.marginBottom = "8px";
    const btn1 = document.createElement('button');
    btn1.className = "popup-btn";
    let pseudo1 = joueursAffichables[i].pseudo;
    btn1.textContent = pseudo1;
    btn1.style.textAlign = "center";
    btn1.style.fontSize = "0.85em";
    btn1.style.width = "140px";
    btn1.style.maxWidth = "140px";
    btn1.style.minWidth = "140px";
    btn1.style.height = "48px";
    btn1.style.padding = "5px 5px"
    btn1.style.overflow = "hidden";
    btn1.style.textOverflow = "ellipsis";
    btn1.style.whiteSpace = "nowrap";
    btn1.onclick = () => {
      hackerPopup.classList.add('hidden');
      onSelect && onSelect(joueursAffichables[i]);
    };
    btn1.style.marginRight = "8px";
    lineDiv.appendChild(btn1);
    if (i + 1 < joueursAffichables.length) {
      const btn2 = document.createElement('button');
      btn2.className = "popup-btn";
      let pseudo2 = joueursAffichables[i + 1].pseudo;
      btn2.textContent = pseudo2;
      btn2.style.textAlign = "center";
      btn2.style.fontSize = "0.85em";
      btn2.style.width = "140px";
      btn2.style.maxWidth = "140px";
      btn2.style.minWidth = "140px";
      btn2.style.height = "48px";
      btn2.style.padding = "5px 5px"
      btn2.style.overflow = "hidden";
      btn2.style.textOverflow = "ellipsis";
      btn2.style.whiteSpace = "nowrap";
      btn2.onclick = () => {
        hackerPopup.classList.add('hidden');
        onSelect && onSelect(joueursAffichables[i + 1]);
      };
      lineDiv.appendChild(btn2);
    }
    btnRow.appendChild(lineDiv);
  }
  const btnCancel = document.getElementById('popupHackerCancel');
  btnCancel.onclick = () => {
    hackerPopup.classList.add('hidden');
    onCancel && onCancel();
  };
  hackerPopup.classList.remove('hidden');
}

function resetJoueurStateUI() {
  mort = false;
  sabotageEnCours = false;
  panneEnCours = false;
  btnHack.disabled = false;
  isZombie = false;
  btnDead.disabled = true;
  btnDead.classList.remove('hidden');
  btnHack.classList.add('hidden');
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
  assassinCooldownSabotageEnd = 0;
  assassinCooldownPanneEnd = 0;
  assassinDelayEnd = 0;
  sabotagePreparing = false;
  pannePreparing = false;
  endTriggered = false;
  lastDesamorcage = 0;
  hackCooldownEnd = 0;
  hackPreparing = false;
  hackerDelayEnd = 0;
  isHacked = false;
  hackedTimerEnd = 0;
  if (hackedTimerInterval) clearInterval(hackedTimerInterval);
  hackedTimerInterval = null;
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
  btnAction.disabled = mort || isZombie || isHacked;
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

function chooseRole(roleName) {
  const pseudo = document.getElementById('pseudoInput').value.trim();
  if (!pseudo) { alert("Entrez un pseudo avant de jouer !"); return; }
  role = roleName;
  showPage(roleName === 'maitre' ? 'maitre' : 'joueur');
  resetJoueurStateUI();
  setActionButtonForRole();
  socket.emit('setRole', { role: roleName, pseudo });
  if (roleName !== 'maitre') setTimeout(() => enableJoueurBtns(), 150);
}

btnInnocent.onclick = function() { chooseRole('innocent'); };
btnAssassin.onclick = function() { chooseRole('assassin'); };
btnHacker.onclick = function() { chooseRole('hacker'); };
btnNecro.onclick = function() { chooseRole('necromancien'); };

btnStart.onclick = function() {
  const assassins = parseInt(assassinsInput.value, 10) || 1;
  const innocents = parseInt(innocentsInput.value, 10) || 1;
  sabotageDuration = parseInt(sabotageDurationInput.value, 10) || 40;
  sabotageCDValue = parseInt(sabotageCDInput.value, 10) || 60;
  debuffDelayValue = parseInt(debuffDelayInput.value, 10) || 10;
  panneDuration = parseInt(panneDurationInput.value, 10) || 20;
  panneCDValue = parseInt(panneCDInput.value, 10) || 90;
  hackDuration = parseInt(hackDurationInput.value, 10) || 60;
  hackCDValue = parseInt(hackCDInput.value, 10) || 90;
  hackdebuffDelayValue = parseInt(hackdebuffDelayInput.value, 10) || 10;
  const zombiesToRelever = parseInt(zombiesToReleverInput.value, 10) || 6;
  socket.emit('start', {
    assassins, innocents,
    sabotageDuration, sabotageCD: sabotageCDValue, debuffDelay: debuffDelayValue,
    sabotageSyncWindow: 1,
    panneDuration, panneCD: panneCDValue,
    hackDuration, hackCD: hackCDValue, hackdebuffDelay: hackdebuffDelayValue,
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
  showConfirmPopup((ok) => {
    if (!ok) return;
    mort = true;
    btnDead.classList.add('hidden');
    btnAction.disabled = true;
    setJoueurReturnBtnsState();
    btnZombie.classList.remove('hidden');
    btnZombie.disabled = false;
    socket.emit('dead', { role });
    showAlert("Tu es mort.", "#da0037", 5000);
    enableJoueurBtns();
  }, "Confirmer que tu es mort ?");
};
btnHack.onclick = function() {
  if (mort || isZombie || endTriggered || !isHacked) return;
  isHacked = false;
  clearInterval(hackedTimerInterval);
  hackedTimerInterval = null;
  btnHack.classList.add('hidden');
  btnDead.classList.remove('hidden');
  enableJoueurBtns();
  setJoueurReturnBtnsState();
  showAlert("Système rétabli !", "#00818a", 2500);
  socket.emit('hackStopped');
};
btnZombie.onclick = function() {
  if (isZombie) return;
  showConfirmPopup((ok) => {
    if (!ok) return;
    isZombie = true;
    btnZombie.disabled = true;
    btnAction.disabled = true;
    socket.emit('zombie');
    showAlert("Tu es un zombie.", "#7900a8", 5000);
    enableJoueurBtns();
  }, "Confirmer que tu deviens un zombie ?");
};

btnAction.onclick = function() {
  if (mort || endTriggered || isZombie) return;
  if (btnAction.dataset.state === "debuff") return;
  if (role === "innocent") {
    showConfirmPopup((ok) => {
      if (!ok) return;
      btnAction.disabled = true;
      btnDead.disabled = true;
      setJoueurReturnBtnsState();
      socket.emit('innocents_win');
    });
  } else if (role === "assassin") {
    const now = Date.now();
    showAssassinActionPopup({
      onBombe: function() {
        if (assassinCooldownSabotageEnd > now) {
          let sec = Math.ceil((assassinCooldownSabotageEnd - now)/1000);
          showTimer(sec);
          showAlert("CD en cours", "#da0037", 1500);
          if (assassinShowTimerSabotageTimeout) clearTimeout(assassinShowTimerSabotageTimeout);
          assassinShowTimerSabotageTimeout = setTimeout(() => hideTimer(), 1500);
          return;
        }
        if (sabotagePreparing && assassinDelayEnd > now) {
          let sec = Math.ceil((assassinDelayEnd - now)/1000);
          showTimer(sec);
          showAlert("Lancement de debuff en cours !", "#f7b801", 1500);
          if (assassinDelayShowTimeout) clearTimeout(assassinDelayShowTimeout);
          assassinDelayShowTimeout = setTimeout(() => hideTimer(), 1500);
          return;
        }
        sabotagePreparing = true;
        showAlert("Bombe lancée !", "#00818a", 1500);
        socket.emit('prepare_sabotage');
      },
      onPanne: function() {
        if (assassinCooldownPanneEnd > now) {
          let sec = Math.ceil((assassinCooldownPanneEnd - now)/1000);
          showTimer(sec);
          showAlert("CD en cours", "#da0037", 1500);
          if (assassinShowTimerPanneTimeout) clearTimeout(assassinShowTimerPanneTimeout);
          assassinShowTimerPanneTimeout = setTimeout(() => hideTimer(), 1500);
          return;
        }
        if (pannePreparing && assassinDelayEnd > now) {
          let sec = Math.ceil((assassinDelayEnd - now)/1000);
          showTimer(sec);
          showAlert("Lancement de debuff en cours !", "#f7b801", 1500);
          if (assassinDelayShowTimeout) clearTimeout(assassinDelayShowTimeout);
          assassinDelayShowTimeout = setTimeout(() => hideTimer(), 1500);
          return;
        }
        pannePreparing = true;
        showAlert("Panne lancée !", "#00818a", 1500);
        socket.emit('prepare_panne');
      },
    oncancel: function() {
      return;
    }
    });
  } else if (role === "hacker") {
    const now = Date.now();
    if (hackCooldownEnd > now) {
      let sec = Math.ceil((hackCooldownEnd - now)/1000);
      showTimer(sec);
      showAlert("CD en cours", "#da0037", 1500);
      if (hackerShowTimerTimeout) clearTimeout(hackerShowTimerTimeout);
      hackerShowTimerTimeout = setTimeout(() => hideTimer(), 1500);
      return;
    }
    if (hackPreparing && hackerDelayEnd > now) {
      let sec = Math.ceil((hackerDelayEnd - now)/1000);
      showTimer(sec);
      showAlert("Envoi de hack en cours !", "#f7b801", 1500);
      if (hackerDelayShowTimeout) clearTimeout(hackerDelayShowTimeout);
      hackerDelayShowTimeout = setTimeout(() => hideTimer(), 1500);
      return;
    }
    showHackerPopup({
      onSelect: function(joueur) {
        hackPreparing = true;
        showAlert("Hack envoyé à " + joueur.pseudo, "#00818a", 1500);
        socket.emit('prepare_hack', { cibleId: joueur.id });
      },
      onCancel: function() {}
    });
    return;
  } else if (role === "necromancien") {
    // Aucune action
  }
};

btnAction.addEventListener('click', function() {
  if(btnAction.dataset.state === "debuff" && !btnAction.disabled && !mort && !isZombie && !endTriggered) {
    const now = Date.now();
    if (now - lastDesamorcage < 1000) return;
    lastDesamorcage = now;
    socket.emit('desamorcage');
    if (btnAction.textContent === "Désamorcer") {
      btnAction.disabled = true;
      setTimeout(() => {
        if(btnAction.dataset.state === "debuff") {
          btnAction.disabled = false;
        }
      }, 3000);
    }
  }
});

socket.on('debut_partie', () => {
  try { audioDebutPartie.currentTime = 0; audioDebutPartie.play(); } catch(e){}
});

let joueursState = [];
socket.on('state', (state) => {
  partieCommencee = state.started;
  joueursState = state.joueurs || [];
  const btnMaitre = document.getElementById('btnMaitre');
  if (btnMaitre) {
    btnMaitre.disabled = !!state.maitrePris;
  }
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
  btnAction.className = "big-btn debuff-btn";
  btnAction.dataset.state = "debuff";
  btnAction.disabled = false;
  btnDead.disabled = mort || isZombie || isHacked;
  setJoueurReturnBtnsState();
  showTimer(duration);
  showAlert("Sabotage ! Deux joueurs doivent désamorcer ensemble.", "#f7b801", 5000);
  if (role !== "maitre" && !mort && !isZombie) {
    try { audioSabotageUp.currentTime = 0; audioSabotageUp.play(); } catch(e){}
  }
  btnReset && (btnReset.disabled = true);
  sabotagePreparing = false;
  lastDesamorcage = 0;
});
socket.on('sabotageStopped', ({delay}) => {
  sabotageCDValue = delay;
  sabotageEnCours = false;
  setActionButtonForRole();
  btnDead.disabled = mort || isZombie || isHacked;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Sabotage désamorcé !", "#00818a", 2500);
  if (role === "assassin") {
    assassinCooldownSabotageEnd = Date.now() + sabotageCDValue * 1000;
    sabotagePreparing = false;
  }
  if (role !== "maitre" && !mort && !isZombie) {
    try { audioSabotageDown.currentTime = 0; audioSabotageDown.play(); } catch(e){}
  }
  btnReset && (btnReset.disabled = false);
});
socket.on('sabotageFailed', function() {
  sabotageEnCours = false;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Sabotage réussi par les assassins ! Fin de partie.", "#da0037", 10000);
  if (role !== "maitre") {
    try { audioAssassins.currentTime = 0; audioAssassins.play(); } catch(e){}
    setTimeout(() => showPage('role'), 10000);
    setTimeout(() => role = null, 10000);
    setTimeout(() => resetJoueurStateUI(), 10000);
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
  endTriggered = true;
});

socket.on('panneStart', function({ duration }) {
  panneEnCours = true;
  btnAction.textContent = "Panne !";
  btnAction.className = "big-btn debuff-btn";
  btnAction.dataset.state = "debuff";
  btnAction.disabled = true;
  btnDead.disabled = mort || isZombie || isHacked;
  setJoueurReturnBtnsState();
  showTimer(duration);
  showAlert("Les lampes sont coupées", "#f7b801", 5000);
  if (role !== "maitre" && !mort && !isZombie) {
    try { audioPanneUp.currentTime = 0; audioPanneUp.play(); } catch(e){}
  }
  btnReset && (btnReset.disabled = true);
  pannePreparing = false;
});
socket.on('panneStopped', ({delay}) => {
  panneCDValue = delay;
  panneEnCours = false;
  setActionButtonForRole();
  btnDead.disabled = mort || isZombie || isHacked;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Les lampes sont restaurées", "#00818a", 2500);
  if (role === "assassin") {
    assassinCooldownPanneEnd = Date.now() + panneCDValue * 1000;
    pannePreparing = false;
  }
  if (role !== "maitre" && !mort && !isZombie) {
    try { audioPanneDown.currentTime = 0; audioPanneDown.play(); } catch(e){}
  }
  btnReset && (btnReset.disabled = false);
});
socket.on('hackStart', ({duration}) => {
  isHacked = true;
  hackedTimerEnd = Date.now() + duration * 1000;
  btnDead.classList.add('hidden');
  btnHack.classList.remove('hidden');
  btnZombie.classList.add('hidden');
  btnDead.disabled = true;
  btnZombie.disabled = true;
  updateHackButton(duration);
  showAlert("Tu es hacké, Rétablis le système !", "#1d8f34", 5000);
  if (hackedTimerInterval) clearInterval(hackedTimerInterval);
  hackedTimerInterval = setInterval(() => {
    const remain = Math.max(0, Math.ceil((hackedTimerEnd - Date.now())/1000));
    updateHackButton(remain);
    if (!isHacked || remain <= 0) {
      clearInterval(hackedTimerInterval);
      hackedTimerInterval = null;
    }
  }, 1000);
});
socket.on('hackFailed', function() {
  mort = true;
  isHacked = false;
  btnDead.classList.add('hidden');
  btnHack.classList.add('hidden');
  btnAction.disabled = true;
  setJoueurReturnBtnsState();
  btnZombie.classList.remove('hidden');
  btnZombie.disabled = false;
  showAlert("Le virus t'a tué !", "#da0037", 5000);
  socket.emit('dead', { role });
  enableJoueurBtns();
});

function updateHackButton(remain) {
  btnHack.innerHTML = `💀 Hacké ! 💀<br><span style="font-size:1em">${remain}s</span>`;
}

socket.on('debuffTimer', function({ seconds }) {
  showTimer(seconds);
});

socket.on('end', ({ winner }) => {
  sabotageEnCours = false;
  panneEnCours = false;
  endTriggered = true;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  clearInterval(hackedTimerInterval);
  setJoueurReturnBtnsState();
  hideTimer();
  if(winner === 'innocents') {
    showAlert("Victoire des innocents !", "#00818a", 10000);
    if (role !== "maitre") {
      try { audioInnocents.currentTime = 0; audioInnocents.play(); } catch(e){}
      setTimeout(() => showPage('role'), 10000);
      setTimeout(() => role = null, 10000);
      setTimeout(() => resetJoueurStateUI(), 10000);
    }
  } else if (winner === 'assassins') {
    showAlert("Victoire des assassins !", "#da0037", 10000);
    if (role !== "maitre") {
      try { audioAssassins.currentTime = 0; audioAssassins.play(); } catch(e){}
      setTimeout(() => showPage('role'), 10000);
      setTimeout(() => role = null, 10000);
      setTimeout(() => resetJoueurStateUI(), 10000);
    }
  } else {
    if (role !== "maitre") {
      showPage('role')
      role = null
      resetJoueurStateUI()
    }
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
  pannePreparing = false;
});

socket.on('necromancien_win', () => {
  sabotageEnCours = false;
  panneEnCours = false;
  endTriggered = true;
  btnAction.disabled = true;
  btnDead.disabled = true;
  btnZombie.disabled = true;
  setJoueurReturnBtnsState();
  hideTimer();
  showAlert("Victoire du Nécromancien !", "#7900a8", 10000);
  if (role !== "maitre") {
    try { audioNecromancien.currentTime = 0; audioNecromancien.play(); } catch(e){}
    setTimeout(() => showPage('role'), 10000);
    setTimeout(() => role = null, 10000);
    setTimeout(() => resetJoueurStateUI(), 10000);
  }
  enableJoueurReturnBtns();
  btnReset && (btnReset.disabled = false);
  enableMaitreReturnBtn();
  sabotagePreparing = false;
  pannePreparing = true;
});

socket.on('debuffDelay', ({delay}) => {
  const now = Date.now();
  debuffDelayValue = delay;
  assassinDelayEnd = now + delay*1000;
  sabotagePreparing = true;
  pannePreparing = true;
});

socket.on('hackdebuffDelay', ({delay}) => {
  const now = Date.now();
  hackdebuffDelayValue = delay;
  hackerDelayEnd = now + delay*1000;
  hackPreparing = true;
});

socket.on('hackCooldown', ({ delay }) => {
  hackCooldownEnd = Date.now() + delay * 1000;
});

socket.on('reset', function() {
  if (role === "maitre") {
    showPage('role');
    resetJoueurStateUI();
    role = null;
    enableMaitreReturnBtn();
    endTriggered = false;
    sabotageEnCours = false;
    panneEnCours = false;
  }
});

function unlockAudio() {
  for (const a of [audioInnocents, audioAssassins, audioSabotageUp, audioSabotageDown, audioPanneUp, audioPanneDown, audioNecromancien]) {
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(()=>{});
  }
  document.removeEventListener('click', unlockAudio);
}
document.addEventListener('click', unlockAudio);

document.addEventListener('DOMContentLoaded', () => {
  const btnMaitre = document.getElementById('btnMaitre');
  if (btnMaitre) {
    btnMaitre.addEventListener('click', () => {
      socket.emit('chooseRole', 'maitre');
    });
  }
});

function showPage(page) {
  rolePage.classList.toggle('hidden', page !== 'role');
  if (page === 'role') {
    socket.emit('leaveRole');
  }
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