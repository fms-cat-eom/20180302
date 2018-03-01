#extension GL_EXT_frag_depth : require
#extension GL_EXT_draw_buffers : require
precision highp float;

uniform vec4 bgColor;

uniform float cameraFar;

// ------

void main() {
  gl_FragData[ 0 ] = vec4( 0.0, 0.0, 0.0, cameraFar );
  gl_FragData[ 1 ] = vec4( 0.0, 0.0, 0.0, 0.0 );
  gl_FragDepthEXT = 1.0;
}