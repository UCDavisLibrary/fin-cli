const assert = require('assert');
const path = require('path');
const config = require('../../lib/models/ConfigModel');
const http = require('../../lib/cli/HttpCli');
const api = require('@ucd-lib/fin-node-api');

// set host for tests
config.host = require('../config').host;

// base container for testing
const id = '_test_'+Math.floor(Math.random()*Date.now());
const childId = `image`;
const copyId = '_test_'+Math.floor(Math.random()*Date.now());
const moveId = '_test_'+Math.floor(Math.random()*Date.now());

describe('Standard HTTP API Request Methods', function() {

  it(`should create a container (${id}) with POST`, async () => {
    var {response} = await http.post({
      path : '',
      options : {
        'data-binary' : path.join(__dirname, 'container-test.ttl'),
        header : [
          `Content-Type: ${api.RDF_FORMATS.TURTLE}`,
          `Slug: ${id}`
        ]
      }
    });

    assert.equal(response.statusCode, 201);
  });

  it('should GET test container', async () => {
    let {response} = await http.get({
      path: id,
      options : {}
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.length > 0, true);
  });

  it('should update container with PUT', async () => {
    let result = await http.get({
      path: id,
      options : {}
    });
    let body = `${result.response.body}\n<> dc:creator "bob" .`;

    result = await http.put({
      path : id,
      options : {
        'no-prefix' : true,
        'data-string' : body,
        header : [
          `Content-Type: ${api.RDF_FORMATS.TURTLE}`
        ]
      }
    });

    assert.equal(result.response.statusCode, 204);
  });

  it('should partial update container with PUT', async () => {
    let result = await http.get({
      path: id,
      options : {
        header : [
          `PREFER: ${api.GET_PREFER.REPRESENTATION_OMIT_SERVER_MANAGED}`
        ]
      }
    });
    let body = `${result.response.body}\n<> dc:contributor "alice" .`;

    let {response} = await http.put({
      path : id,
      options : {
        'no-prefix' : true,
        'data-string' : body,
        header : [
          `Prefer: handling=lenient; received="minimal"`,
          `Content-Type: ${api.RDF_FORMATS.TURTLE}`
        ]
      }
    });

    assert.equal(response.statusCode, 204);
  });

  it('should allow sparql update with PATCH', async () => {
    let {response} = await http.patch({
      path : id,
      options : {
        'no-prefix' : true,
        'data-string' : `
          PREFIX dc: <http://purl.org/dc/elements/1.1/>
          DELETE {
            <> dc:creator "bob" .
          }
          INSERT {
            <> dc:creator "fred" .
          }
          WHERE {}
        `
      }
    });

    assert.equal(response.statusCode, 204);
  });

  it('should get resource header with HEAD', async () => {
    let {response} = await http.head({
      path : id,
      options : {}
    });

    assert.equal(response.statusCode, 200);
  });

  it('should create child binary resource with POST', async () => {
    var {response} = await http.post({
      path : id,
      options : {
        'data-binary' : path.join(__dirname, 'image.jpg'),
        header : [
          `Content-Type: image/jpeg`,
          `Slug: ${childId}`
        ]
      }
    });

    assert.equal(response.statusCode, 201);
  });

  it(`should copy container tree with COPY (${id} to ${copyId})`, async () => {
    var {response, options} = await http.copy({
      path : id,
      destination : copyId,
      options : {}
    });

    assert.equal(response.statusCode, 201);

    let result = await http.get({
      path: copyId+'/image',
      options : {}
    });
    assert.equal(result.response.statusCode, 200);

  });

  it(`should move container tree with MOVE (${copyId} to ${moveId}`, async () => {
    var {response, options} = await http.move({
      path : copyId,
      destination : moveId,
      options : {}
    });

    assert.equal(response.statusCode, 201);

    let result = await http.get({
      path: moveId+'/image',
      options : {}
    });
    assert.equal(result.response.statusCode, 200);

  });

  it(`should cleanup test containers (${id}, ${moveId}) with DELETE`, async () => {
    var {response} = await http.delete({
      path : id,
      options : {}
    });

    assert.equal(response.statusCode, 204);

    var {response} = await http.delete({
      path : id+'/fcr:tombstone',
      options : {}
    });

    assert.equal(response.statusCode, 204);

    let result = await http.get({
      path: id,
      options : {}
    });
    assert.equal(result.response.statusCode, 404);

    // remove copied, then moved container tree
    var {response} = await http.delete({
      path : moveId,
      options : {}
    });

    assert.equal(response.statusCode, 204);

    var {response} = await http.delete({
      path : moveId+'/fcr:tombstone',
      options : {}
    });

    assert.equal(response.statusCode, 204);
  });

});