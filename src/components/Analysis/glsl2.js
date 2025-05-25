export default `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform samplerCube shadowMap_textureCube;
uniform mat4 shadowMap_matrix;
uniform vec4 shadowMap_lightPositionEC;
uniform vec4 shadowMap_normalOffsetScaleDistanceMaxDistanceAndDarkness;
uniform vec4 shadowMap_texelSizeDepthBiasAndNormalShadingSmooth;
uniform float helsing_viewDistance;
uniform vec4 helsing_visibleAreaColor;
uniform vec4 helsing_invisibleAreaColor;
uniform mat4 camera_view_matrix;
uniform mat4 camera_projection_matrix;

varying vec2 v_textureCoordinates;

vec4 toEye(in vec2 uv, in float depth) {
  vec2 xy = vec2((uv.x * 2.0 - 1.0), (uv.y * 2.0 - 1.0));
  vec4 posInCamera = czm_inverseProjection * vec4(xy, depth, 1.0);
  posInCamera = posInCamera / posInCamera.w;
  return posInCamera;
}

float getDepth(in vec4 depth) {
  float z_window = czm_unpackDepth(depth);
  z_window = czm_reverseLogDepth(z_window);
  float n_range = czm_depthRange.near;
  float f_range = czm_depthRange.far;
  return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
}

float shadow_visibility(in vec4 positionEC) {
  vec3 directionEC = positionEC.xyz - shadowMap_lightPositionEC.xyz;
  float distance = length(directionEC);
  directionEC = normalize(directionEC);
  
  float radius = helsing_viewDistance;
  float bias = shadowMap_texelSizeDepthBiasAndNormalShadingSmooth.z;
  float depth = distance / radius - bias;
  float visibility = czm_shadowVisibility(
    shadowMap_textureCube, 
    directionEC, 
    depth, 
    shadowMap_texelSizeDepthBiasAndNormalShadingSmooth.xy
  );
  return visibility;
}

void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec4 depth = texture(depthTexture, v_textureCoordinates);
  float gl_depth = getDepth(depth);
  vec4 viewPos = toEye(v_textureCoordinates, gl_depth);
  
  // 裁剪掉背景
  if (gl_depth >= 0.98) {
    gl_FragColor = color;
    return;
  }

  vec4 positionEC = czm_inverseModelView * vec4(viewPos.xyz, 1.0);
  float visibility = shadow_visibility(positionEC);
  
  vec4 visibleColor = helsing_visibleAreaColor;
  vec4 invisibleColor = helsing_invisibleAreaColor;
  
  if (visibility > 0.3) {
    gl_FragColor = vec4(mix(color.rgb, visibleColor.rgb, visibleColor.a), color.a);
  } else {
    gl_FragColor = vec4(mix(color.rgb, invisibleColor.rgb, invisibleColor.a), color.a);
  }
}
`;
