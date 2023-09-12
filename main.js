import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { TextGeometry } from "three/addons/geometries/TextGeometry";
import { FontLoader } from "three/addons/loaders/FontLoader";

function main() {
  // Canvas and Renderer
  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.shadowMap.enabled = true;

  // Camera
  const fov = 80;
  const aspect = 2;
  const near = 0.1;
  const far = 200;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 25, 72);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 15, 0);
  controls.update();

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('white');

  // Ground Plane
  // addGroundPlane(scene);

  // Lights
  addHemisphereLight(scene);
  addDirectionalLight(scene);

  // Model Loading
  let mixer;
  loadGLTFModel(scene, mixer);

  // Animation Loop
  animate(renderer, scene, camera);

  function addGroundPlane(scene) {
    const planeSize = 100;
    const loader = new THREE.TextureLoader();
    const texture = loader.load('https://threejs.org/manual/examples/resources/images/checker.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    const repeats = planeSize / 200;
    texture.repeat.set(repeats, repeats);

    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMat = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.rotation.x = Math.PI * -0.5;
    scene.add(mesh);
  }

  function addHemisphereLight(scene) {
    const skyColor = 0xB1E1FF;
    const groundColor = 0xB97A20;
    const intensity = 3;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  function addDirectionalLight(scene) {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 0, 2);
    scene.add(light);
    scene.add(light.target);
  }

  let catBoundingBox = new THREE.Box3();
  let catModelRoot;

  function loadGLTFModel(scene) {
    const gltfLoader = new GLTFLoader();
    const url = 'assets/3d_models/cat/scene.gltf';

    gltfLoader.load(url, (gltf) => {
      catModelRoot = gltf.scene; // Store the reference globally or in module scope

      ["Boitan", "Camoue"].forEach(name => {
        let object = catModelRoot.getObjectByName(name);
        object.parent.remove(object);
      });

      scene.add(catModelRoot);

      // Calculate bounding box of the model
      catModelRoot.traverse((node) => {
        if (node.isMesh) {
          node.geometry.computeBoundingBox();
          catBoundingBox.union(node.geometry.boundingBox);
        }
      });

      mixer = new THREE.AnimationMixer(catModelRoot);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    });
  }

  function dumpObjectHierarchy(obj, lines = [], isLast = true, prefix = '') {
    const localPrefix = isLast ? '└─' : '├─';
    lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    obj.children.forEach((child, ndx, arr) => {
      dumpObjectHierarchy(child, lines, ndx === arr.length - 1, newPrefix);
    });
    return lines;
  }

  function animate(renderer, scene, camera) {
    const clock = new THREE.Clock();

    function render(time) {
      if (resizeRendererToDisplaySize(renderer)) {
        camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
        camera.updateProjectionMatrix();
      }

      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);

      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = window.innerWidth - 500;
    const height = window.innerHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  }

  document.getElementById('chat-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMessageToUI('User', event.target.value);  // Record user message
      addMessageToUI('Agent', event.target.value);  // Record bot message
      displayChatBubble(event.target.value);
      event.target.value = '';
    }
  });

  let currentBubbleMesh, currentTextMesh; // References to the current chat bubble and text

  function addMessageToUI(speaker, message) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add(speaker.toLowerCase() + "-message", "message-wrapper");

    const messageDiv = document.createElement('div');
    messageDiv.classList.add("message");
    messageDiv.textContent = message;

    messageWrapper.appendChild(messageDiv);
    document.getElementById('messages').appendChild(messageWrapper);
  }

  function wrapText(message, maxChars) {
    const words = message.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length < maxChars) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);  // push the last line into lines

    // For very long words that exceed maxChars
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].length > maxChars) {
        const longWord = lines.splice(j, 1)[0];
        const breakIndex = maxChars;
        lines.splice(j, 0, longWord.slice(0, breakIndex));
        lines.splice(j + 1, 0, longWord.slice(breakIndex));
      }
    }

    return lines.join('\n');
  }

  function displayChatBubble(message) {
    // If there's a previous bubble or text, remove them
    if (currentBubbleMesh) {
      catModelRoot.remove(currentBubbleMesh);
    }

    if (currentTextMesh) {
      catModelRoot.remove(currentTextMesh);
    }

    // Split the message if it's longer than 50 characters
    message = wrapText(message, 50);

    const numberOfLines = message.split('\n').length;

    const bubbleLoader = new GLTFLoader();
    const bubbleUrl = 'assets/3d_models/bubble_speech/scene.gltf';

    bubbleLoader.load(bubbleUrl, (gltf) => {
      const bubbleRoot = gltf.scene;

      const scaleMultiplierX = Math.min(27, message.length * 0.7);  // adjust as required
      const scaleMultiplierZ = 2.7 * numberOfLines; // scale in Z based on number of lines
      bubbleRoot.scale.set(scaleMultiplierX, 1, scaleMultiplierZ);

      // Adjust bubble position based on the number of lines
      bubbleRoot.position.copy(catBoundingBox.max);
      bubbleRoot.position.y -= (0.5 * numberOfLines);  // adjust this value as required to prevent overlap
      bubbleRoot.position.z -= 10;
      bubbleRoot.rotation.x = Math.PI / 2;

      catModelRoot.add(bubbleRoot);

      // Store reference to the current bubble
      currentBubbleMesh = bubbleRoot;

      // Load the 3D font and create the 3D text
      const loader = new FontLoader();
      loader.load('assets/fonts/helvetiker_regular.typeface.json', function (font) {
        const textGeometry = new TextGeometry(message, {
          font: font,
          size: 2,
          height: 0.5,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 0.2,
          bevelSize: 0.05,
          bevelOffset: 0,
          bevelSegments: 5,
          kerning: 1
        });

        const textMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);

        textMesh.position.copy(bubbleRoot.position);
        textMesh.position.x -= scaleMultiplierX; // adjust this for better text alignment
        textMesh.position.z += 0.1;
        textMesh.position.y += numberOfLines * 0.7 - 1;
        bubbleRoot.rotation.x = Math.PI / 2;

        catModelRoot.add(textMesh);

        // Store reference to the current text
        currentTextMesh = textMesh;
      });
    });
  }
}

main();
