'use client';

import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { tsParticles } from 'tsparticles-engine';

const Particles = dynamic(() => import('react-tsparticles'), {
  ssr: false, 
});

const ParticlesBackground = () => {
  const particlesInit = useCallback(async (engine: any) => {
    await tsParticles.load('tsparticles', engine); // Initialize particles with container ID
  }, []);

  const particlesLoaded = useCallback(async (container: any) => {
    // You can interact with the container once particles are loaded, if needed.
  }, []);

  const particlesOptions = {
    particles: {
      number: {
        value: 100,
      },
      size: {
        value: 3,
      },
      move: {
        speed: 1,
        direction: 'none',
      },
    },
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
    <Particles
      id="tsparticles"
      init={particlesInit}
      loaded={particlesLoaded}
      options={particlesOptions} 
    />
  </div>
  
  );
};

export default ParticlesBackground;
