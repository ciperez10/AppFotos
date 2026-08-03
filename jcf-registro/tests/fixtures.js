export const OCR_FIXTURES = Object.freeze({
  identity: `CÉDULA 999-9999999-0\nLUGAR DE NACIMIENTO: PUERTO CLARO, ISLA PRUEBA\nFECHA DE NACIMIENTO: 29 FEBRERO 2000\nNACIONALIDAD: PAÍS DE PRUEBA\nSEXO: F\nTIPO DE SANGRE: AB+\nESTADO CIVIL: SOLTERA\nOCUPACIÓN: EMPLEADO (A) PÚBLICO\nFECHA DE EXPIRACIÓN: 01 ENERO 2032`,
  noisyPlace: 'LUGAR DE NACIMIENTO: I I I I J J J FECHA DE NACIMIENTO',
  names: [
    { value: 'LUMA TERA', confidence: 82, source: 'gris' },
    { value: 'LUMA TERA', confidence: 76, source: 'binario' },
    { value: 'MIO', confidence: 91, source: 'ruido' }
  ]
});
