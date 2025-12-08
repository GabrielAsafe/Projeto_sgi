import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ========================
// Cena, câmera, renderer
// ========================

// canvas
const threeCanvas = document.getElementById("three-canvas");

// renderer
const renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
renderer.setClearColor(0xffffff);
renderer.shadowMap.enabled = true;

// cena
const cena = new THREE.Scene();
window.cena = cena;

// câmera
const camera = new THREE.PerspectiveCamera(
  60,
  threeCanvas.clientWidth / threeCanvas.clientHeight,
  0.01,
  1000
);
camera.position.set(0.739, 0.356, -0.038);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// luz
cena.add(new THREE.AmbientLight(0xffffff, 3));

// ========================
// Variáveis globais
// ========================
let BASE = null;
let TAMPA = null;
let estadoOriginalTampa = {};
let estadoOriginalBase = {};
// ========================
// Singleton de animações
// ========================

const AnimacaoManager = (function () {
  let instance;

  function init() {
    let mixer = null; // UM ÚNICO MIXER
    const actions = {};
    let currentAction = null;
    let sequenceRunning = false;
    const animationStates = {};

    return {
      toggleAction: (name) => {
        const action = actions[name];
        if (!action) return console.warn("Ação não encontrada:", name);

        if (animationStates[name] === undefined) {
          animationStates[name] = false;
        }

        currentAction = action;

        // CASO ESPECIAL: DISCO
        if (name === "RotateDisk") {
          if (!animationStates[name]) {
            action.stop();
            action.reset();
            action.enabled = true;
            action.setLoop(THREE.LoopRepeat);
            action.timeScale = 1;
            action.play();
            animationStates[name] = true;
          } else {
            action.stop();
            animationStates[name] = false;
          }
          return;
        }

        // CASO NORMAL
        action.stop();
        action.reset();
        action.enabled = true;
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;

        if (!animationStates[name]) {
          action.timeScale = 1;
          action.time = 0;
          action.play();
          animationStates[name] = true;
        } else {
          action.timeScale = -1;
          action.time = action.getClip().duration;
          action.play();
          animationStates[name] = false;
        }
      },

      // ===== MIXER =====
      setMixer: (m) => {
        mixer = m;
      },

      getMixer: () => mixer,

      update: (delta) => {
        if (mixer) mixer.update(delta);
      },

      // ===== ANIMATION STATES =====
      getAnimationState: (name) => animationStates[name],

      setAnimationState: (name, value) => {
        animationStates[name] = value;
      },

      hasAnimationState: (name) => animationStates[name] !== undefined,
      // ===== ACTIONS =====
      registerAction: (name, action) => {
        actions[name] = action;
        action.clampWhenFinished = true;
        action.loop = THREE.LoopOnce;
      },

      getAction: (name) => actions[name],

      // ===== CURRENT ACTION =====
      setCurrentAction: (action) => {
        currentAction = action;
      },

      getCurrentAction: () => currentAction,

      // ===== SEQUENCE CONTROL =====
      isSequenceRunning: () => sequenceRunning,

      playSequence: (seq) => {
        //não vou implementar isso.
      },

      // ===== CONTROLES =====
      pauseCurrent: () => {
        if (currentAction) currentAction.paused = true;
      },

      resumeCurrent: () => {
        if (currentAction) currentAction.paused = false;
      },

      stopAll: () => {
        // Para todas as actions registradas
        Object.values(actions).forEach((action) => {
          action.stop();
          action.enabled = false;
        });

        // Reseta todos os estados das animações
        Object.keys(animationStates).forEach((key) => {
          animationStates[key] = false;
        });

        currentAction = null;
      },

      restartCurrent: () => {
        if (currentAction) {
          currentAction.stop();
          currentAction.reset();
          currentAction.play();
        }
      },
    };
  }

  return {
    getInstance: () => (instance ??= init()),
  };
})();

const animManager = AnimacaoManager.getInstance();

// ========================
// Carregar modelo GLTF
// ========================
new GLTFLoader().load("models/RecordPlayer.gltf", (gltf) => {
  // registrar mixer
  animManager.setMixer(new THREE.AnimationMixer(gltf.scene));

  // registrar animações
  gltf.animations.forEach((clip) => {
    animManager.registerAction(
      clip.name,
      animManager.getMixer().clipAction(clip)
    );
  });

  // detectar objetos importantes
  gltf.scene.traverse((obj) => {
    //console.log(obj.name);
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    // Guardar estado original

    // BASE
    if (obj.name === "Base") {
      BASE = obj;
      //console.log("BASE encontrada:", obj);

      estadoOriginalBase = {
        color: BASE.material.color.clone(),
        material: BASE.material.clone(),
        visible: BASE.visible,
        castShadow: BASE.castShadow,
      };
    }

    // TAMPA (Cube.017 e Cube.003 no gltf)
    if (obj.name === "DustCover") {
      TAMPA = obj;
      //console.log("TAMPA encontrada:", obj);

      estadoOriginalTampa = {
        color: TAMPA.material.color.clone(),
        material: TAMPA.material.clone(),
        visible: TAMPA.visible,
        castShadow: TAMPA.castShadow,
      };
    }
  });

  cena.add(gltf.scene);

  // Centralizar câmera
  centralizarCamera(gltf.scene);

  // Botões de animação
  configurarBotoesAnimacao();
});

// ========================
// Loop de animação
// ========================
const clock = new THREE.Clock();
function animar() {
  requestAnimationFrame(animar);
  animManager.update(clock.getDelta());
  renderer.render(cena, camera);
}
animar();

// ========================
// FUNÇÕES (ficam no final!)
// ========================

// responsividade
window.addEventListener("resize", onWindowResize);

// centralizar
function centralizarCamera(model) {
  const bbox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  controls.target.copy(center);
  camera.lookAt(center);
  controls.update();
}

// ajustes ao redimensionar
function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// configura botões  aqui ele define a sequencia como seq
function configurarBotoesAnimacao() {
  const seq = [
    "OpenCover",
    "PosicionarAgulha",
    "RotateDisk",
    "RemoverAgulha",
    "CloseCover",
  ];

  document
    .getElementById("start")
    ?.addEventListener("click", () => animManager.playSequence(seq));

  document
    .getElementById("pause")
    ?.addEventListener("click", () => animManager.pauseCurrent());

  document
    .getElementById("resume")
    ?.addEventListener("click", () => animManager.resumeCurrent());

  document
    .getElementById("stop")
    ?.addEventListener("click", () => animManager.stopAll());

  document
    .getElementById("restart")
    ?.addEventListener("click", () => animManager.restartCurrent());
  document
    .getElementById("open_close_lid")
    ?.addEventListener("click", () => animManager.toggleAction("OpenCover"));

  document
    .getElementById("rotate_stop_spin")
    ?.addEventListener("click", () => animManager.toggleAction("RotateDisk"));

  document
    .getElementById("position_remove_neddle")
    ?.addEventListener("click", () =>
      animManager.toggleAction("PosicionarAgulha")
    );
}

// ========================
// BOTÕES DO MENU (cor/material)
// ========================
document.getElementById("btn_cor")?.addEventListener("click", () => {
  if (BASE)
    BASE.material.color = new THREE.Color(
      Math.random(),
      Math.random(),
      Math.random()
    );
  if (TAMPA)
    TAMPA.material.color = new THREE.Color(
      Math.random(),
      Math.random(),
      Math.random()
    );
});

const textureLoader = new THREE.TextureLoader();

function carregarTextura(path) {
  const tex = textureLoader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4); // Ajuste conforme necessário
  return tex;
}

const materiais = {
  carpete: new THREE.MeshStandardMaterial({
    map: carregarTextura("materials/Carpet/Carpet016_1K-JPG_Color.jpg"),
    normalMap: carregarTextura(
      "materials/Carpet/Carpet016_1K-JPG_NormalGL.jpg"
    ),
    roughnessMap: carregarTextura(
      "materials/Carpet/Carpet016_1K-JPG_Roughness.jpg"
    ),
    aoMap: carregarTextura(
      "materials/Carpet/Carpet016_1K-JPG_AmbientOcclusion.jpg"
    ),

    displacementMap: carregarTextura(
      "materials/Carpet/Carpet016_1K-JPG_Displacement.jpg"
    ),
    displacementScale: 0.05, // Ajuste conforme necessário

    metalness: 0,
    roughness: 1,
  }),
};

document.getElementById("btn_material")?.addEventListener("click", () => {
  //if (BASE) BASE.material = materiais.carpete;

  if (TAMPA) TAMPA.material = materiais.carpete;
});

document.getElementById("btn_repor").addEventListener("click", () => {
  if (BASE) {
    BASE.material = estadoOriginalBase.material.clone();
    BASE.visible = estadoOriginalBase.visible;
    BASE.castShadow = estadoOriginalBase.castShadow;
  }

  if (TAMPA) {
    TAMPA.material = estadoOriginalTampa.material.clone();
    TAMPA.visible = estadoOriginalTampa.visible;
    TAMPA.castShadow = estadoOriginalTampa.castShadow;
  }
});
