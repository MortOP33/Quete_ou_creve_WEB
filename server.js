const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let game = {};
let players = {};
let sabotage = null;
let panne = null;
let hack = null;

// --- Variables pour le nécromancien
let zombiesToRelever = 2; // Réglé par le maître, valeur par défaut
let zombiesCount = 0;

function resetGame() {
  for (let id in players) {
    players[id].hasbeenHacked = false;
    if (players[id].hackTimer) {
      clearTimeout(players[id].hackTimer);
      players[id].hackTimer = null;
    }
    players[id].hacked = false;
  }
  game = {
    started: false,
    innocents: 0,
    assassins: 0,
    hacker: 0,
    necromancien: 0,
    innocentsDead: 0,
    assassinsDead: 0,
    hackerDead: 0,
    necromancienDead: 0,
    sabotage: false,
    sabotageId: 0,
    sabotageDuration: 40,
    sabotageCD: 60,
    debuffDelay: 10,
    sabotageSyncWindow: 1,
    panne: false,
    panneId: 0,
    panneDuration: 20,
    panneCD: 90,
    hack: false,   
    hackDuration: 60,
    hackCD: 90,  
    hackdebuffDelay: 10,
  };
  players = {};
  sabotage = {
    timer: null,
    endTime: null,
    clicks: [],
    actif: false,
    id: 0,
    preparing: false,
    prepareTimer: null,
    prepareEndTime: null,
    lastSabotageEnd: 0
  };
  panne = {
    timer: null,
    endTime: null,
    clicks: [],
    actif: false,
    id: 0,
    preparing: false,
    prepareTimer: null,
    prepareEndTime: null,
    lastPanneEnd: 0
  };
  hack = {
    timer: null,
    endTime: null,
    clicks: [],
    actif: false,
    id: 0,
    preparing: false,
    prepareTimer: null,
    prepareEndTime: null,
  };
  zombiesToRelever = 2;
  zombiesCount = 0;
}
resetGame();

function emitState() {
  const maitrePris = Object.values(players).some(player => player.role === 'maitre');
  const joueurs = Object.entries(players).map(([id, data]) => ({
    id,
    pseudo: data.pseudo || '',
    role: data.role || '',
    mort: !!data.mort,
    zombie: !!data.zombie,
    hacked: !!data.hacked,
    hasbeenHacked: !!data.hasbeenHacked
  }));
  io.emit('state', {
    maitrePris: maitrePris,
    joueurs: joueurs,
    assassins: game.assassins,
    innocents: game.innocents,
    hacker: game.hacker,
    necromancien: game.necromancien,
    assassinsDead: game.assassinsDead,
    innocentsDead: game.innocentsDead,
    hackerDead: game.hackerDead,
    necromancienDead: game.necromancienDead,
    started: game.started,
    sabotage: sabotage.actif,
    panne: panne.actif,
    hack: hack.actif,
    antiHackCode: game.antiHackCode || "123",
    zombies: zombiesCount,
    zombiesToRelever: zombiesToRelever
  });
}

function stopSabotage() {
  if (sabotage.timer) {
    clearInterval(sabotage.timer);
    sabotage.timer = null;
  }
  sabotage.actif = false;
  sabotage.clicks = [];
  sabotage.preparing = false;
  sabotage.prepareEndTime = null;
  sabotage.prepareTimer && clearTimeout(sabotage.prepareTimer);
  sabotage.prepareTimer = null;
  emitState();
}

function stopPanne() {
  if (panne.timer) {
    clearInterval(panne.timer);
    panne.timer = null;
  }
  panne.actif = false;
  panne.clicks = [];
  panne.preparing = false;
  panne.prepareEndTime = null;
  panne.prepareTimer && clearTimeout(panne.prepareTimer);
  panne.prepareTimer = null;
  emitState();
}

function stopHack() {
  if (hack.timer) {
    clearInterval(hack.timer);
    hack.timer = null;
  }
  hack.actif = false;
  hack.cibleId = null;
  hack.preparing = false;
  hack.prepareEndTime = null;
  hack.prepareTimer && clearTimeout(hack.prepareTimer);
  hack.prepareTimer = null;
  emitState();
}

function checkEndGame() {
  if (game.assassinsDead >= game.assassins && game.assassins > 0) {
    stopSabotage();
    stopPanne();
    stopHack();
    io.emit('end', {winner: 'innocents'});
    for (const [socketId, player] of Object.entries(players)) {
      if(player.role === 'maitre') io.to(socketId).emit('reset');
    }
    resetGame();
    emitState();
    return true;
  } else if (game.innocentsDead + game.hackerDead + game.necromancienDead >= game.innocents + game.hacker + game.necromancien  > 0) {
    stopSabotage();
    stopPanne();
    stopHack();
    io.emit('end', {winner: 'assassins'});
    for (const [socketId, player] of Object.entries(players)) {
      if(player.role === 'maitre') io.to(socketId).emit('reset');
    }
    resetGame();
    emitState();
    return true;
  }
  return false;
}

io.on('connection', (socket) => {
  socket.on('setRole', ({role, pseudo}) => {
    if (['maitre', 'innocent', 'assassin','hacker','necromancien'].includes(role)) {
      players[socket.id] = {role, mort: false, zombie: false, pseudo: (pseudo||''), hacked: false, hackTimer: null};
      emitState();
    }
  });

  socket.on('leaveRole', () => {
    if (players[socket.id]) {
      players[socket.id].role = undefined;
      emitState();
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    emitState();
  });

  socket.on('start', ({
    assassins, innocents, hacker, necromancien,
    sabotageDuration, sabotageCD, debuffDelay, sabotageSyncWindow,
    panneDuration, panneCD,
    hackDuration, hackCD, hackdebuffDelay,
    zombiesToRelever: zTR,
    antiHackCode
  }) => {
    game.started = true;
    game.assassins = parseInt(assassins, 10) || 1;
    game.innocents = parseInt(innocents, 10) || 1;
    game.hacker = parseInt(hacker, 10) || 0;
    game.necromancien = parseInt(necromancien, 10) || 0;
    game.sabotageDuration = parseInt(sabotageDuration, 10) || 40;
    game.sabotageCD = parseInt(sabotageCD, 10) || 60;
    game.debuffDelay = parseInt(debuffDelay, 10) || 10;
    game.sabotageSyncWindow = parseInt(sabotageSyncWindow, 10) || 1;
    game.panneDuration = parseInt(panneDuration, 10) || 20;
    game.panneCD = parseInt(panneCD, 10) || 90;
    game.hackDuration = parseInt(hackDuration, 10) || 60;
    game.hackCD = parseInt(hackCD, 10) || 90;
    game.hackdebuffDelay = parseInt(hackdebuffDelay, 10) || 10;
    game.antiHackCode = (antiHackCode || "123");
    zombiesToRelever = parseInt(zTR, 10) || 2;
    zombiesCount = 0;
    for (let id in players) {
      players[id].mort = false;
      players[id].zombie = false;
      players[id].hacked = false;
      if (players[id].hackTimer) {
        clearTimeout(players[id].hackTimer);
        players[id].hackTimer = null;
      }
    }
    stopSabotage();
    stopPanne();
    stopHack();
    io.emit('debut_partie');
    io.emit('wait_actions', { seconds: 20 });
    emitState();
  });

  socket.on('dead', () => {
    if (!game.started) return;
    if (!players[socket.id] || players[socket.id].mort) return;
    players[socket.id].mort = true;
    switch (players[socket.id].role) {
      case 'innocent':
      case 'hacker':
      case 'necromancien':
        game.innocentsDead++;
        break;
      case 'assassin':
        game.assassinsDead++;
        break;
      default: break;
    }
    emitState();
    checkEndGame();
  });

  // Gestion du bouton "Je suis un zombie !"
  socket.on('zombie', () => {
    if (!game.started) return;
    if (!players[socket.id] || players[socket.id].zombie) return;
    players[socket.id].zombie = true;
    zombiesCount++;
    emitState();
    if (zombiesCount >= zombiesToRelever) {
      stopSabotage();
      stopPanne();
      stopHack();
      io.emit('necromancien_win');
      for (const [socketId, player] of Object.entries(players)) {
        if(player.role === 'maitre') io.to(socketId).emit('reset');
      }
      resetGame();
      emitState();
    }
  });

  socket.on('innocents_win', () => {
    if (game.started) {
      stopSabotage();
      stopPanne();
      stopHack();
      io.emit('end', {winner: 'innocents'});
      for (const [socketId, player] of Object.entries(players)) {
        if(player.role === 'maitre') io.to(socketId).emit('reset');
      }
      resetGame();
      emitState();
    }
  });

  socket.on('hacker_win', () => {
    stopSabotage();
    stopPanne();
    stopHack();
    io.emit('hacker_win');
    for (const [socketId, player] of Object.entries(players)) {
      if(player.role === 'maitre') io.to(socketId).emit('reset');
    }
    resetGame();
    emitState();
  });

  // --- Gestion du sabotage
  socket.on('prepare_sabotage', () => {
    const now = Date.now();
    if (!game.started || sabotage.actif || sabotage.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'assassin' || players[socket.id].mort) return;
    // CD entre sabotages
    if (sabotage.lastSabotageEnd && now - sabotage.lastSabotageEnd < game.sabotageCD * 1000) return;
    sabotage.preparing = true;
    sabotage.prepareEndTime = now + game.debuffDelay * 1000;
    io.emit('debuffDelay', {delay: game.debuffDelay});
    sabotage.prepareTimer = setTimeout(() => {
      sabotage.preparing = false;
      sabotage.prepareTimer = null;
      sabotageStart(game.sabotageDuration);
    }, game.debuffDelay * 1000);
  });

  socket.on('desamorcage', () => {
    if (!sabotage.actif) return;
    if (!players[socket.id] || players[socket.id].mort) return;
    let now = Date.now();
    sabotage.clicks.push({id: socket.id, at: now});
    if (sabotage.clicks.length > 2) sabotage.clicks.shift();
    if (sabotage.clicks.length === 2) {
      const [a, b] = sabotage.clicks;
      if (a.id !== b.id && Math.abs(a.at - b.at) <= (game.sabotageSyncWindow || 1) * 1000) {
        stopSabotage();
        io.emit('sabotageStopped', {delay: game.sabotageCD});
        emitState();
      }
    }
  });

  function sabotageStart(duration) {
    sabotage.actif = true;
    sabotage.endTime = Date.now() + (duration || game.sabotageDuration) * 1000;
    sabotage.clicks = [];
    sabotage.id += 1;
    io.emit('sabotageStart', {duration: (duration || game.sabotageDuration)});
    emitState();
    if (sabotage.timer) clearInterval(sabotage.timer);
    sabotage.timer = setInterval(() => {
      let remaining = Math.max(0, Math.floor((sabotage.endTime - Date.now())/1000));
      io.emit('debuffTimer', {seconds: remaining});
      if (remaining <= 0) {
        stopSabotage();
        io.emit('sabotageFailed');
        io.emit('end', {winner: 'assassins'});
        for (const [socketId, player] of Object.entries(players)) {
          if(player.role === 'maitre') io.to(socketId).emit('reset');
        }
        resetGame();
        emitState();
      }
    }, 1000);
  }

  // --- Gestion de la panne
  socket.on('prepare_panne', () => {
    const now = Date.now();
    if (!game.started || panne.actif || panne.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'assassin' || players[socket.id].mort) return;
    // CD entre pannes
    if (panne.lastPanneEnd && now - panne.lastpanneEnd < game.panneCD * 1000) return;
    panne.preparing = true;
    panne.prepareEndTime = now + game.debuffDelay * 1000;
    io.emit('debuffDelay', {delay: game.debuffDelay});
    panne.prepareTimer = setTimeout(() => {
      panne.preparing = false;
      panne.prepareTimer = null;
      panneStart(game.panneDuration);
    }, game.debuffDelay * 1000);
  });

  function panneStart(duration) {
    panne.actif = true;
    panne.endTime = Date.now() + (duration || game.panneDuration) * 1000;
    panne.clicks = [];
    panne.id += 1;
    io.emit('panneStart', {duration: (duration || game.panneDuration)});
    emitState();
    if (panne.timer) clearInterval(panne.timer);
    panne.timer = setInterval(() => {
      let remaining = Math.max(0, Math.floor((panne.endTime - Date.now())/1000));
      io.emit('debuffTimer', {seconds: remaining});
      if (remaining <= 0) {
        stopPanne();
        io.emit('panneStopped', {delay: game.panneCD});
        emitState();
      }
    }, 1000);
  }

  // --- Gestion du hack
  socket.on('prepare_hack', ({ cibleId }) => {
    const now = Date.now();
    if (!game.started || hack.actif || hack.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'hacker' || players[socket.id].mort) return;
    // CD entre hacks
    hack.preparing = true;
    hack.cibleId = cibleId;
    hack.prepareEndTime = now + game.hackdebuffDelay * 1000;
    io.to(socket.id).emit('hackdebuffDelay', {delay: game.hackdebuffDelay});
    hack.prepareTimer = setTimeout(() => {
      hack.preparing = false;
      hack.prepareTimer = null;
      hackStart(cibleId, game.hackDuration, socket.id);
    }, game.hackdebuffDelay * 1000);
  });

  function hackStart(cibleId, duration, hackerSocketId) {
    hack.actif = true;
    hack.endTime = Date.now() + (duration || game.hackDuration) * 1000;
    hack.id += 1;
    hack.hackerSocketId = hackerSocketId;
    players[cibleId].hacked = true;
    players[cibleId].hasbeenHacked = true;
    if (!players[cibleId].mort && !players[cibleId].zombie) {
      io.to(cibleId).emit('hackStart', {duration: (duration || game.hackDuration)});
    }
    io.to(hackerSocketId).emit('hackCooldown', { delay: game.hackCD });
    emitState();
    if (players[cibleId].hackTimer) clearTimeout(players[cibleId].hackTimer);
    players[cibleId].hackTimer = setTimeout(() => {
      stopHack();
      if (!players[cibleId].mort && !players[cibleId].zombie) {
        io.to(cibleId).emit('hackFailed');
      }
      emitState();
    }, (duration || game.hackDuration) * 1000);
  }

  socket.on('hackStopped', () => {
    if (!game.started) return;
    if (!players[socket.id] || !players[socket.id].hacked) return;
    players[socket.id].hacked = false;
    if (hack.timer) {
      clearInterval(hack.timer);
      hack.timer = null;
    }
    if (players[socket.id].hackTimer) {
      clearInterval(players[socket.id].hackTimer);
      players[socket.id].hackTimer = null;
    }
    stopHack();
    emitState();
  });

  socket.on('reset', () => {
    stopSabotage();
    stopPanne();
    stopHack();
    io.emit('end', {winner: 'none'});
    for (const [socketId, player] of Object.entries(players)) {
      if(player.role === 'maitre') io.to(socketId).emit('reset');
    }
    resetGame();
    emitState();
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    emitState();
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Serveur lancé sur http://localhost:' + PORT);
});