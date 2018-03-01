#define HUGE 9E16
#define PI 3.14159265
#define V vec3(0.,1.,-1.)
#define saturate(i) clamp(i,0.,1.)
#define lofi(i,m) (floor((i)/(m))*(m))

// ------

attribute vec2 uv;
attribute float triIndex;

varying vec3 vPos;
varying vec3 vNor;
varying vec2 vShadowCoord;

uniform float time;
uniform vec2 resolution;
uniform vec3 cameraPos;
uniform float cameraFov;

uniform mat4 matP;
uniform mat4 matV;
uniform mat4 matPL;
uniform mat4 matVL;
uniform mat4 matM;

uniform bool isShadow;

uniform sampler2D samplerTerrain;
uniform sampler2D samplerUV;

// ------

vec3 calcNormal( vec3 v0, vec3 v1, vec3 v2 ) {
  vec3 a = normalize( v1 - v0 );
  vec3 b = normalize( v2 - v0 );
  return normalize( cross( a, b ) );
}

void main() {
  vec4 p = matM * texture2D( samplerTerrain, uv );
  vPos = p.xyz;

  vec4 outPos;
  if ( isShadow ) {
    outPos = matPL * matVL * p;
  } else {
    outPos = matP * matV * p;

    vec3 v0 = texture2D( samplerTerrain, texture2D( samplerUV, vec2( 0.5 / 3.0, triIndex ) ).xy ).xyz;
    vec3 v1 = texture2D( samplerTerrain, texture2D( samplerUV, vec2( 1.5 / 3.0, triIndex ) ).xy ).xyz;
    vec3 v2 = texture2D( samplerTerrain, texture2D( samplerUV, vec2( 2.5 / 3.0, triIndex ) ).xy ).xyz;
    vNor = calcNormal( v0, v1, v2 );

    vec4 posFromLight = matPL * matVL * p;
    vShadowCoord = posFromLight.xy / posFromLight.w * 0.5 + 0.5;
  }
  gl_Position = outPos;
}