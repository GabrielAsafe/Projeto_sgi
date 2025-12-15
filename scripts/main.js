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
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
renderer.setClearColor(0x000000, 0); // FUNDO TRANSPARENTE

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

//luz tipo sol - faz cast de sombras -  valor por definição
let luz = new THREE.DirectionalLight(0xffffff, 1);
luz.position.set(5, 10, 5);
cena.add(luz);

let luz_tipo = "lamp"; // "lamp" ou "cone"

const luz_cor = 0xffffff;
const luz_intensidade = 10.0;
const luz_distancia = 5.0;

if (luz_tipo === "lamp") {
  luz = new THREE.PointLight(luz_cor, luz_intensidade, luz_distancia);
} else if (luz_tipo === "cone") {
  luz = new THREE.SpotLight(luz_cor, luz_intensidade, luz_distancia);
  luz.angle = Math.PI / 6;
}

luz.position.set(1, 0, 0);
cena.add(luz);

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

        currentAction = name; // ✅ AGORA guardamos o NOME da animação

        const display = document.getElementById("displayText");
        if (display) {
          display.textContent = "Animação: " + name;
        }

        // ===== CASO ESPECIAL: DISCO =====
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

            if (display) {
              display.textContent = "Animação: Nenhuma";
            }
          }
          return;
        }

        // ===== CASO NORMAL =====
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

          if (display) {
            display.textContent = "Animação: Nenhuma";
          }
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
        const display = document.getElementById("displayText");
        if (currentAction && actions[currentAction]) {
          actions[currentAction].paused = true;
          if (display)
            display.textContent = "Animação pausada: " + currentAction;
        }
      },

      resumeCurrent: () => {
        const display = document.getElementById("displayText");
        if (currentAction && actions[currentAction]) {
          actions[currentAction].paused = false;
          if (display) display.textContent = "Animação: " + currentAction;
        }
      },

      stopAll: () => {
        Object.values(actions).forEach((action) => {
          action.stop();
          action.enabled = false;
        });

        Object.keys(animationStates).forEach((key) => {
          animationStates[key] = false;
        });

        currentAction = null;

        const display = document.getElementById("displayText");
        if (display) display.textContent = "Animação: Nenhuma";
      },

      restartCurrent: () => {
        const display = document.getElementById("displayText");
        if (currentAction && actions[currentAction]) {
          actions[currentAction].stop();
          actions[currentAction].reset();
          actions[currentAction].play();

          if (display) display.textContent = "Animação: " + currentAction;
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

    // TAMPA
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
// FUNÇÕES
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

  document.getElementById("displayText").textContent =
    "Animação: " + animManager.getAction();
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
    displacementScale: 0.05,

    metalness: 0,
    roughness: 1,
  }),

  //   ground: new THREE.MeshStandardMaterial({
  //   map: carregarTextura("materials/Ground/Ground095C_1K-JPG_Color.jpg"),
  //   normalMap: carregarTextura(
  //     "materials/Ground/Ground095C_1K-JPG_NormalGL.jpg"
  //   ),
  //   roughnessMap: carregarTextura(
  //     "materials/Ground/Ground095C_1K-JPG_Roughness.jpg"
  //   ),
  //   aoMap: carregarTextura(
  //     "materials/Ground/Ground095C_1K-JPG_AmbientOcclusion.jpg"
  //   ),

  //   displacementMap: carregarTextura(
  //     "materials/Ground/Ground095C_1K-JPG_Displacement.jpg"
  //   ),
  //   displacementScale: 0.05,

  //   metalness: 0,
  //   roughness: 1,
  // }),

  pizza: new THREE.MeshStandardMaterial({
    map: carregarTextura("materials/Pizza/Pizza001_1K-JPG_Color.jpg"),
    normalMap: carregarTextura("materials/Pizza/Pizza001_1K-JPG_NormalGL.jpg"),
    roughnessMap: carregarTextura(
      "materials/Pizza/Pizza001_1K-JPG_Roughness.jpg"
    ),
    aoMap: carregarTextura(
      "materials/Pizza/Pizza001_1K-JPG_AmbientOcclusion.jpg"
    ),

    displacementMap: carregarTextura(
      "materials/Pizza/Pizza001_1K-JPG_Displacement.jpg"
    ),
    displacementScale: 0,

    metalness: 0,
    roughness: 1,
  }),

  madeira: new THREE.MeshStandardMaterial({
    map: carregarTextura("materials/WoodFloor/WoodFloor070_1K-JPG_Color.jpg"),
    normalMap: carregarTextura(
      "materials/WoodFloor/WoodFloor070_1K-JPG_NormalGL.jpg"
    ),
    roughnessMap: carregarTextura(
      "materials/WoodFloor/WoodFloor070_1K-JPG_Roughness.jpg"
    ),

    displacementMap: carregarTextura(
      "materials/WoodFloor/WoodFloor070_1K-JPG_Displacement.jpg"
    ),
    displacementScale: 0.05,

    metalness: 0,
    roughness: 1,
  }),
};
const listaMateriais = Object.values(materiais);

let contadorMaterial = 0;

document.getElementById("btn_material")?.addEventListener("click", () => {
  if (!BASE) return;

  contadorMaterial = (contadorMaterial + 1) % listaMateriais.length;

  BASE.material = listaMateriais[contadorMaterial];
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

function setupSlider(sliderId, spanId, callback) {
  const slider = document.getElementById(sliderId);
  const span = document.getElementById(spanId);

  slider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    span.textContent = val;
    callback(val);
  });
}

// posição
setupSlider("luz_x", "valor_x", (val) => (luz.position.x = val));
setupSlider("luz_y", "valor_y", (val) => (luz.position.y = val));
setupSlider("luz_z", "valor_z", (val) => (luz.position.z = val));

// intensidade e distância
setupSlider(
  "luz_intensidade",
  "valor_intensidade",
  (val) => (luz.intensity = val)
);

const corInput = document.getElementById("cor_luz");
const valorCor = document.getElementById("valor_cor");

corInput.addEventListener("input", (e) => {
  const hex = e.target.value;
  valorCor.textContent = hex;
  luz.color.set(hex);
  console.log(hex);
});
