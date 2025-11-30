import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ========================
// Cena, câmera, renderer
// ========================
const cena = new THREE.Scene();
window.cena = cena;

const threeCanvas = document.getElementById("three-canvas");

const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
renderer.setClearColor(0xffffff);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(
  60,
  threeCanvas.clientWidth / threeCanvas.clientHeight,
  0.01,
  1000
);
camera.position.set(0.739, 0.356, -0.038);
camera.rotation.set(
  THREE.MathUtils.degToRad(-96.6),
  THREE.MathUtils.degToRad(72.89),
  THREE.MathUtils.degToRad(96.9)
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

const ambientLight = new THREE.AmbientLight(0xffffff, 3);
cena.add(ambientLight);

// ========================
// Responsividade
// ========================
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onWindowResize, { passive: true });
onWindowResize();

// ========================
// Singleton: AnimacaoManager
// ========================
const AnimacaoManager = (function () {
  let instance;

  function init() {
    const mixers = [];
    const actions = {};
    let currentSequence = [];
    let sequenceIndex = 0;
    let currentAction = null;

    return {
      currentAction, // action atual
      getAction: (name) => actions[name],
      registerMixer: (mixer) => mixers.push(mixer),
      registerAction: (name, action) => {
        actions[name] = action;
        action.clampWhenFinished = true;
        action.loop = THREE.LoopOnce;
      },

      playAction: (name) => {
        const action = actions[name];
        if (!action) return console.warn(`Ação ${name} não encontrada`);
        currentAction = action;
        action.play();
      },

      pauseCurrent: () => {
        if (currentAction) currentAction.paused = true;
      },
      resumeCurrent: () => {
        if (currentAction) currentAction.paused = false;
      },
      stopCurrent: () => {
        if (currentAction) currentAction.stop();
      },
      restartCurrent: () => {
        if (currentAction) {
          currentAction.stop();
          currentAction.reset();
          currentAction.play();
        }
      },

      playSequence: (seq) => {
  if (!seq || seq.length === 0) return;

  // **Stop e reset de qualquer ação atual**
  if (currentAction) {
    currentAction.stop();
    currentAction.reset();
    currentAction.timeScale = 1; // garante que toque para frente
  }

  // **Remove todos os listeners de finished antigos**
  mixers.forEach((mixer) => {
    mixer._listeners = {}; // limpa todos os listeners antigos
  });

  // Prepara a nova sequência
  currentSequence = seq.filter((name) => actions[name]);
  sequenceIndex = 0;
  instance._playNextInSequence();
},


      _playNextInSequence: () => {
        if (sequenceIndex >= currentSequence.length) return;

        const name = currentSequence[sequenceIndex];

        console.log(`Iniciando ação da sequência: ${name}`);
        
        const action = actions[name];
        if (!action) {
          sequenceIndex++;
          instance._playNextInSequence();
          return;
        }

        currentAction = action;
        action.play();

        const mixer = window.mixer;
        const callback = (e) => {
          if (e.action === action) {
            mixer.removeEventListener("finished", callback);
            sequenceIndex++;
            instance._playNextInSequence();
          }
        };
        mixer.addEventListener("finished", callback);
      },

      update: (delta) => mixers.forEach((m) => m.update(delta)),
    };
  }

  return {
    getInstance: () => {
      if (!instance) instance = init();
      return instance;
    },
  };
})();

// ========================
// Carregar GLTF e registrar animações
// ========================
const animManager = AnimacaoManager.getInstance();

new GLTFLoader().load("models/RecordPlayer.gltf", (gltf) => {


    


  const mixer = new THREE.AnimationMixer(gltf.scene);
  window.mixer = mixer;
  animManager.registerMixer(mixer);

  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    animManager.registerAction(clip.name, action);
    console.log("Animação carregada:", clip.name);
  });

  cena.add(gltf.scene);

  // sombras
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (
            m &&
            (m.opacity < 1 || m.alphaMode === "BLEND" || m.transmission > 0)
          ) {
            m.transparent = true;
            m.depthWrite = false;
            m.needsUpdate = true;
          }
        });
      } else if (
        obj.material &&
        (obj.material.opacity < 1 ||
          obj.material.alphaMode === "BLEND" ||
          obj.material.transmission > 0)
      ) {
        obj.material.transparent = true;
        obj.material.depthWrite = false;
        obj.material.needsUpdate = true;
      }
    }
  });

  // centralizar câmera
  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const modelCenter = new THREE.Vector3();
  bbox.getCenter(modelCenter);
  controls.target.copy(modelCenter);
  camera.position.copy(modelCenter.clone().add(camera.position));
  camera.lookAt(modelCenter);
  controls.update();

  // Sequência principal e reversa
  const sequence = ["OpenCover", "PosicionarAgulha", "RotateDisk"];
  const reverseSequence = ["RotateDisk", "PosicionarAgulha", "OpenCover"];

  document
    .getElementById("start")
    ?.addEventListener("click", () => animManager.playSequence(sequence));
  document
    .getElementById("reverse")
    ?.addEventListener("click", () =>
      animManager.playSequence(reverseSequence)
    );

  document
    .getElementById("pause")
    ?.addEventListener("click", () => animManager.pauseCurrent());
  document
    .getElementById("resume")
    ?.addEventListener("click", () => animManager.resumeCurrent());
  document
    .getElementById("stop")
    ?.addEventListener("click", () => animManager.stopCurrent());
  document
    .getElementById("restart")
    ?.addEventListener("click", () => animManager.restartCurrent());

  // ========================
  // Toggle individual (frente/reverso)
  // ========================
  const animStates = {
    OpenCover: false,
    PosicionarAgulha: false,
    RotateDisk: false,
  };

  function toggleAction(name) {
    const action = animManager.getAction(name);
    if (!action) return;

    // Para a action atual se for diferente
    if (animManager.currentAction && animManager.currentAction !== action) {
      animManager.currentAction.stop();
    }

    if (!animStates[name]) {
      action.time = 0;
      action.timeScale = 1;
    } else {
      action.time = action.getClip().duration;
      action.timeScale = -1;
    }

    action.play();
    animManager.currentAction = action;
    animStates[name] = !animStates[name];

    console.log(`${name} toggled to ${animStates[name]}`);
  }

  document
    .getElementById("open_close_lid")
    ?.addEventListener("click", () => toggleAction("OpenCover"));
  document
    .getElementById("position_remove_needle")
    ?.addEventListener("click", () => toggleAction("PosicionarAgulha"));
  document
    .getElementById("rotate_stop_spin")
    ?.addEventListener("click", () => toggleAction("RotateDisk"));
});

// ========================
// Loop de animação
// ========================
const clock = new THREE.Clock();
function animar() {
  requestAnimationFrame(animar);
  const delta = clock.getDelta();
  animManager.update(delta);

  renderer.render(cena, camera);
}
animar();
