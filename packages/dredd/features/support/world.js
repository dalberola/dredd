const { setWorldConstructor } = require('cucumber');


const API_DESCRIPTION_EXTS = {
  'application/vnd.oai.openapi': '.openapi3.yaml',
};

const HOOKS_EXTS = {
  'application/vnd.oai.openapi': '.openapi3.js',
};


function DreddWorld({ attach, parameters }) {
  this.attach = attach;
  this.parameters = parameters;

  this.apiDescriptionFormat =
    parameters.apiDescriptionFormat || 'application/vnd.oai.openapi';
  this.apiDescriptionExt = API_DESCRIPTION_EXTS[this.apiDescriptionFormat];
  this.hooksExt = HOOKS_EXTS[this.apiDescriptionFormat];

  this.dredd = {
    apiDescription: null,
    apiLocation: 'http://127.0.0.1:3000',
    args: [],
    output: '',
    exitStatus: null,
  };
}


setWorldConstructor(DreddWorld);
