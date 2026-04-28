import Matter from 'matter-js';

export const Engine = Matter.Engine;
export const Render = Matter.Render;
export const Runner = Matter.Runner;
export const Bodies = Matter.Bodies;
export const Composite = Matter.Composite;
export const Vector = Matter.Vector;
export const Body = Matter.Body;
export const Events = Matter.Events;

export const engine = Engine.create();
// Disable gravity for top-down game
engine.gravity.y = 0;
engine.gravity.x = 0;

export const world = engine.world;
