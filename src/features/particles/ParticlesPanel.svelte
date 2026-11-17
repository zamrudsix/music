<script lang="ts">
  import { projectStore } from '../../lib/stores/project.svelte';
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <span class="font-medium text-neutral-300">Enable Particles</span>
    <input 
      type="checkbox" 
      bind:checked={projectStore.project.overlays.particle.enabled}
      onchange={() => projectStore.saveToDB(300)}
      class="accent-cyan-500 w-4 h-4 cursor-pointer"
    />
  </div>

  <div>
    <span class="block text-neutral-400 mb-1.5 font-medium">Preset</span>
    <select 
      bind:value={projectStore.project.overlays.particle.preset}
      onchange={() => projectStore.saveToDB(500)}
      class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:border-cyan-500 outline-none cursor-pointer"
    >
      <option value="Classic Particle Visualizer">Classic Particle Visualizer</option>
      <option value="Floating Particles">Floating Particles</option>
      <option value="Galaxy Particles">Galaxy Particles</option>
      <option value="Starfield Particles">Starfield Particles</option>
      <option value="Firefly Particles">Firefly Particles</option>
      <option value="Neon Particle Explosion">Neon Particle Explosion</option>
      <option value="Audio Reactive Particles">Audio Reactive Particles</option>
      <option value="Circular Particle Ring">Circular Particle Ring</option>
      <option value="Particle Waveform">Particle Waveform</option>
      <option value="Particle Spectrum">Particle Spectrum</option>
      <option value="3D Particle Sphere">3D Particle Sphere</option>
      <option value="Particle Tunnel">Particle Tunnel</option>
      <option value="Cosmic Dust Particles">Cosmic Dust Particles</option>
      <option value="Sparkle Particles">Sparkle Particles</option>
      <option value="Snowfall Particles">Snowfall Particles</option>
      <option value="Rain Particles">Rain Particles</option>
      <option value="Fire Particles">Fire Particles</option>
      <option value="Smoke Particles">Smoke Particles</option>
      <option value="Water Bubble Particles">Water Bubble Particles</option>
      <option value="Magic Dust Particles">Magic Dust Particles</option>
      <option value="Glowing Orb Particles">Glowing Orb Particles</option>
      <option value="DNA Particle Animation">DNA Particle Animation</option>
      <option value="Digital Matrix Particles">Digital Matrix Particles</option>
      <option value="Electric Spark Particles">Electric Spark Particles</option>
      <option value="Rainbow Particle Flow">Rainbow Particle Flow</option>
      <option value="Liquid Particle Flow">Liquid Particle Flow</option>
      <option value="Particle Vortex">Particle Vortex</option>
      <option value="Particle Swarm">Particle Swarm</option>
      <option value="Meteor Shower Particles">Meteor Shower Particles</option>
      <option value="Holographic Particle Field">Holographic Particle Field</option>
      <option value="Aurora Particle Flow">Aurora Particle Flow</option>
      <option value="Plasma Particle Storm">Plasma Particle Storm</option>
      <option value="Golden Dust Particles">Golden Dust Particles</option>
      <option value="Cyberpunk Particle Grid">Cyberpunk Particle Grid</option>
      <option value="3D Galaxy Spiral">3D Galaxy Spiral</option>
      <option value="Magnetic Particle Field">Magnetic Particle Field</option>
      <option value="Particle Heartbeat">Particle Heartbeat</option>
      <option value="Neon DNA Helix">Neon DNA Helix</option>
      <option value="Quantum Particle Cloud">Quantum Particle Cloud</option>
      <option value="Infinity Particle Loop">Infinity Particle Loop</option>
      <option value="Audio Sphere">🌟 Audio Sphere (New)</option>
      <option value="Frequency Swarm">🎵 Frequency Swarm (New)</option>
      <option value="Beat Explosion">💥 Beat Explosion (New)</option>
      <option value="Galaxy Spiral">🌌 Galaxy Spiral (New)</option>
      <option value="Neon Fireflies">✨ Neon Fireflies (New)</option>
      <option value="Orbit Pulse">🌀 Orbit Pulse (New)</option>
      <option value="Ring Burst">💫 Ring Burst (New)</option>
      <option value="Center Bloom">🌸 Center Bloom (New)</option>
      <option value="Bintik (Dust)">Bintik (Dust)</option>
      <option value="Sparkles">Sparkles</option>
      <option value="Stars">Stars</option>
      <option value="Gentle Snow">Gentle Snow</option>
      <option value="Salju">Salju</option>
      <option value="Asap">Asap</option>
      <option value="Percikan Api">Percikan Api</option>
      <option value="Kabut">Kabut</option>
      <option value="Hujan Neon">Hujan Neon</option>
      <option value="Confetti">Confetti</option>
      <option value="NCS Particles">NCS Particles</option>
      <option value="Particles Rise">Particles Rise</option>
      <option value="Particle Burst">Particle Burst</option>
      <option value="Vortex Particles">Vortex Particles</option>
      <option value="Meteor Shower">Meteor Shower</option>
      <option value="Orbit Dust">Orbit Dust</option>
      <option value="Galaxy Dust">Galaxy Dust</option>
      <option value="Beat Spark">Beat Spark</option>
      <!-- Fallback / Legacy -->
      <option value="floating-dust">Floating Dust (Legacy)</option>
      <option value="bokeh">Bokeh Glow</option>
      <option value="snow">Snow (Legacy)</option>
      <option value="sparks">Beat Sparks (Legacy)</option>
    
      <option value="Ponco Triangles">Ponco Triangles</option>
      <option value="Ponco Squares">Ponco Squares</option>
      <option value="Ponco Diamonds">Ponco Diamonds</option>
      <!-- New Audio-Reactive Styles (20) -->
      <option value="Audio Sphere">Audio Sphere</option>
      <option value="Frequency Swarm">Frequency Swarm</option>
      <option value="Beat Explosion">Beat Explosion</option>
      <option value="Rising Bubbles">Rising Bubbles</option>
      <option value="Neon Fireflies">Neon Fireflies</option>
      <option value="Galaxy Spiral">Galaxy Spiral</option>
      <option value="Shockwave Rings">Shockwave Rings</option>
      <option value="Magnetic Flow">Magnetic Flow</option>
      <option value="Bass Pulse">Bass Pulse</option>
      <option value="Treble Sparkles">Treble Sparkles</option>
      <option value="Midrange Drift">Midrange Drift</option>
      <option value="Particle Fountain">Particle Fountain</option>
      <option value="Audio Cloud">Audio Cloud</option>
      <option value="Waveform Dust">Waveform Dust</option>
      <option value="Circular Burst">Circular Burst</option>
      <option value="Gravity Well">Gravity Well</option>
      <option value="Trail Comets">Trail Comets</option>
      <option value="Color Shift Swarm">Color Shift Swarm</option>
      <option value="Interactive Orbit">Interactive Orbit</option>
      <option value="Music Note Rain">Music Note Rain</option>
    </select>
  </div>

  <div>
    <div class="flex justify-between text-neutral-400 mb-1">
      <span>Particle Count</span>
      <span>{projectStore.project.overlays.particle.count}</span>
    </div>
    <input 
      type="range" 
      min="10" 
      max="300" 
      bind:value={projectStore.project.overlays.particle.count}
      onchange={() => projectStore.saveToDB(400)}
      class="w-full accent-cyan-500 cursor-pointer"
    />
  </div>

  <div>
    <div class="flex justify-between text-neutral-400 mb-1">
      <span>Particle Size</span>
      <span>{projectStore.project.overlays.particle.size}px</span>
    </div>
    <input 
      type="range" 
      min="1" 
      max="30" 
      bind:value={projectStore.project.overlays.particle.size}
      onchange={() => projectStore.saveToDB(400)}
      class="w-full accent-cyan-500 cursor-pointer"
    />
  </div>

  <div>
    <div class="flex justify-between text-neutral-400 mb-1">
      <span>Particle Speed</span>
      <span>{(projectStore.project.overlays.particle.speed ?? 1.0).toFixed(1)}x</span>
    </div>
    <input 
      type="range" 
      min="0.2" 
      max="3.0" 
      step="0.1" 
      bind:value={projectStore.project.overlays.particle.speed}
      onchange={() => projectStore.saveToDB(400)}
      class="w-full accent-cyan-500 cursor-pointer"
    />
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div>
      <span class="block text-neutral-400 mb-1">Color Tint</span>
      <div class="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
        <input 
          type="color" 
          bind:value={projectStore.project.overlays.particle.color} 
          onchange={() => projectStore.saveToDB(500)} 
          class="w-6 h-6 bg-transparent border-0 cursor-pointer" 
        />
        <span class="font-mono text-[11px]">{projectStore.project.overlays.particle.color}</span>
      </div>
    </div>
    <div>
      <span class="block text-neutral-400 mb-1">Opacity: {Math.round((projectStore.project.overlays.particle.opacity ?? 0.8) * 100)}%</span>
      <input 
        type="range" 
        min="0.1" 
        max="1.0" 
        step="0.05" 
        bind:value={projectStore.project.overlays.particle.opacity}
        onchange={() => projectStore.saveToDB(400)}
        class="w-full accent-cyan-500 cursor-pointer mt-2"
      />
    </div>
  </div>


  <div class="grid grid-cols-2 gap-3 p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80">
    <label class="flex items-center gap-2 text-neutral-300 text-sm">
      <input type="checkbox" checked={projectStore.project.overlays.particle.rainbow ?? false} onchange={(e) => { projectStore.project.overlays.particle.rainbow = e.currentTarget.checked; projectStore.saveToDB(300); }} class="accent-cyan-500" />
      RGB / Rainbow
    </label>
    <label class="flex items-center gap-2 text-neutral-300 text-sm">
      <input type="checkbox" checked={projectStore.project.overlays.particle.glow ?? true} onchange={(e) => { projectStore.project.overlays.particle.glow = e.currentTarget.checked; projectStore.saveToDB(300); }} class="accent-cyan-500" />
      Glow / Neon
    </label>
    <div class="col-span-2">
      <div class="flex justify-between text-neutral-400 text-xs mb-1"><span>Bass Sensitivity</span><span>{(projectStore.project.overlays.particle.bassSensitivity ?? 1).toFixed(1)}x</span></div>
      <input type="range" min="0.2" max="3" step="0.1" value={projectStore.project.overlays.particle.bassSensitivity ?? 1} oninput={(e) => { projectStore.project.overlays.particle.bassSensitivity = Number(e.currentTarget.value); projectStore.saveToDB(400); }} class="w-full accent-cyan-500" />
    </div>
    <div class="col-span-2">
      <div class="flex justify-between text-neutral-400 text-xs mb-1"><span>Treble Sensitivity</span><span>{(projectStore.project.overlays.particle.trebleSensitivity ?? 1).toFixed(1)}x</span></div>
      <input type="range" min="0.2" max="3" step="0.1" value={projectStore.project.overlays.particle.trebleSensitivity ?? 1} oninput={(e) => { projectStore.project.overlays.particle.trebleSensitivity = Number(e.currentTarget.value); projectStore.saveToDB(400); }} class="w-full accent-cyan-500" />
    </div>
  </div>
  <!-- Follow Beat -->
  <div class="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800/80 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-neutral-300 font-medium">Follow Beat</span>
      <input 
        type="checkbox" 
        bind:checked={projectStore.project.overlays.particle.followBeat}
        onchange={() => projectStore.saveToDB(300)}
        class="accent-cyan-500 w-4 h-4 cursor-pointer"
      />
    </div>

    {#if projectStore.project.overlays.particle.followBeat}
      <div>
        <div class="flex justify-between text-neutral-400 text-[11px] mb-1">
          <span>Particle Beat Sensitivity</span>
          <span>{(projectStore.project.overlays.particle.beatSensitivity ?? 1.0).toFixed(1)}x</span>
        </div>
        <input 
          type="range" 
          min="0.2" 
          max="3.0" 
          step="0.1" 
          bind:value={projectStore.project.overlays.particle.beatSensitivity}
          onchange={() => projectStore.saveToDB(400)}
          class="w-full accent-cyan-500 cursor-pointer"
        />
      </div>
    {/if}
  </div>
</div>
