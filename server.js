const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let game = {};
let players = {};
let sabotage = null;

// --- Variables pour le nécromancien
let zombiesToRelever = 2; // Réglé par le maître, valeur par défaut
let zombiesCount = 0;

function resetGame() {
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
    sabotageDelay: 10,
    sabotageSyncWindow: 1
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
  zombiesToRelever = 2;
  zombiesCount = 0;
}
resetGame();

function emitState() {
  io.emit('state', {
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

function checkEndGame() {
  if (game.assassinsDead >= game.assassins && game.assassins > 0) {
    stopSabotage();
    io.emit('end', {winner: 'innocents'});
    for (const [socketId, player] of Object.entries(players)) {
      if(player.role === 'maitre') io.to(socketId).emit('reset');
    }
    resetGame();
    emitState();
    return true;
  }
  if (game.innocentsDead + game.hackerDead + game.necromancienDead >= game.innocents + game.hacker + game.necromancien  > 0) {
    stopSabotage();
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
  socket.on('setRole', ({role}) => {
    if (['maitre', 'innocent', 'assassin','hacker','necromancien'].includes(role)) {
      players[socket.id] = {role, mort: false, zombie: false};
    }
  });

  socket.on('start', ({
    assassins, innocents, hacker, necromancien,
    sabotageDuration, sabotageCD, sabotageDelay, sabotageSyncWindow, zombiesToRelever: zTR
  }) => {
    game.started = true;
    game.assassins = parseInt(assassins, 10) || 1;
    game.innocents = parseInt(innocents, 10) || 1;
    game.hacker = parseInt(hacker, 10) || 0;
    game.necromancien = parseInt(necromancien, 10) || 0;
    game.sabotageDuration = parseInt(sabotageDuration, 10) || 40;
    game.sabotageCD = parseInt(sabotageCD, 10) || 60;
    game.sabotageDelay = parseInt(sabotageDelay, 10) || 10;
    game.sabotageSyncWindow = parseInt(sabotageSyncWindow, 10) || 1;
    zombiesToRelever = parseInt(zTR, 10) || 2;
    zombiesCount = 0;
    for (let id in players) {
      players[id].mort = false;
      players[id].zombie = false;
    }
    stopSabotage();
    io.emit('debut_partie');
    emitState();
  });

  socket.on('dead', () => {
    if (!game.started) return;
    if (!players[socket.id] || players[socket.id].mort) return;
    players[socket.id].mort = true;
    switch (players[socket.id].role) {
      case 'innocent': game.innocentsDead++; break;
      case 'assassin': game.assassinsDead++; break;
      case 'hacker': game.hackerDead++; break;
      case 'necromancien': game.necromancienDead++; break;
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
      io.emit('end', {winner: 'innocents'});
      for (const [socketId, player] of Object.entries(players)) {
        if(player.role === 'maitre') io.to(socketId).emit('reset');
      }
      resetGame();
      emitState();
    }
  });

  // --- Gestion du sabotage
  socket.on('prepare_sabotage', () => {
    const now = Date.now();
    if (!game.started || sabotage.actif || sabotage.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'assassin' || players[socket.id].mort) return;
    // CD entre sabotages
    if (sabotage.lastSabotageEnd && now - sabotage.lastSabotageEnd < game.sabotageCD * 1000) return;
    sabotage.preparing = true;
    sabotage.prepareEndTime = now + game.sabotageDelay * 1000;
    io.emit('sabotageDelay', {delay: game.sabotageDelay});
    sabotage.prepareTimer = setTimeout(() => {
      sabotage.preparing = false;
      sabotage.prepareTimer = null;
      sabotageStart(game.sabotageDuration);
    }, game.sabotageDelay * 1000);
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
        io.emit('sabotageStopped');
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
      io.emit('sabotageTimer', {seconds: remaining});
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

  socket.on('reset', () => {
    stopSabotage();
    io.emit('reset');
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

// Coucou c'est Dralnar !