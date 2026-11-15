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
    
      <option value="Ponco Neon Dust">Ponco Neon Dust</option>
      <option value="Ponco Fireflies">Ponco Fireflies</option>
      <option value="Ponco Galaxy Dust">Ponco Galaxy Dust</option>
      <option value="Ponco Rain Glow">Ponco Rain Glow</option>
      <option value="Ponco Spark Burst">Ponco Spark Burst</option>
      <option value="Ponco Aurora Particles">Ponco Aurora Particles</option>
      <option value="Ponco Cyber Bits">Ponco Cyber Bits</option>
      <option value="Ponco Bubble Rise">Ponco Bubble Rise</option>
      <option value="Ponco Star Field">Ponco Star Field</option>
      <option value="Ponco Energy Orbs">Ponco Energy Orbs</option>
      <option value="Ponco Glitch Dots">Ponco Glitch Dots</option>
      <option value="Ponco Prism Rain">Ponco Prism Rain</option>
      <option value="Ponco Void Particles">Ponco Void Particles</option>
      <option value="Ponco Holo Specks">Ponco Holo Specks</option>
      <option value="Ponco Bass Sparks">Ponco Bass Sparks</option>
      <option value="Ponco Liquid Drops">Ponco Liquid Drops</option>
      <option value="Ponco Quantum Dust">Ponco Quantum Dust</option>
      <option value="Ponco Neon Confetti">Ponco Neon Confetti</option>
      <option value="Ponco Plasma Bits">Ponco Plasma Bits</option>
      <option value="Ponco Orbit Motes">Ponco Orbit Motes</option>
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
