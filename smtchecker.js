var commandExistsSync = require('command-exists').sync;
var execSync = require('child_process').execSync;
var fs = require('fs-extra');
var tmp = require('tmp');

var potentialSolvers = [
  {
    name: 'z3',
    params: '-smt2'
  },
  {
    name: 'cvc4',
    params: '--lang=smt2'
  }
];
var solvers = potentialSolvers.filter(solver => commandExistsSync(solver.name));

function solve (query) {
  var tmpFile = tmp.fileSync({ postfix: '.smt2' });
  fs.writeFileSync(tmpFile.name, query);
  // TODO For now only the first SMT solver found is used.
  // At some point a computation similar to the one done in
  // SMTPortfolio::check should be performed, where the results
  // given by different solvers are compared and an error is
  // reported if solvers disagree (i.e. SAT vs UNSAT).
  var outputStr;
  try {
    var solverOutput = execSync(
      solvers[0].name + ' ' + solvers[0].params + ' ' + tmpFile.name, {
        timeout: 10000
      }
    );
    outputStr = solverOutput.toString();
  } catch (e) {
    // execSync throws if the process times out or returns != 0.
    // The latter might happen with z3 if the query asks for a model
    // for an UNSAT formula. We can still use stdout.
    outputStr = e.stdout.toString();
    if (
      !outputStr.startsWith('sat') &&
      !outputStr.startsWith('unsat') &&
      !outputStr.startsWith('unknown')
    ) {
      throw new Error('Failed solve SMT query. ' + e.toString());
    }
  }
  // Trigger early manual cleanup
  tmpFile.removeCallback();
  return { contents: outputStr };
}

// This function checks the standard JSON output for auxiliaryInputRequested,
// where smtlib2queries represent the queries created by the SMTChecker.
// The function runs an SMT solver on each query and adjusts the input for
// another run.
// Returns null if no solving is requested.
function handleSMTQueries (inputJSON, outputJSON) {
  var auxInputReq = outputJSON.auxiliaryInputRequested;
  if (!auxInputReq) {
    return null;
  }

  var queries = auxInputReq.smtlib2queries;
  if (!queries || Object.keys(queries).length === 0) {
    return null;
  }

  if (solvers.length === 0) {
    throw new Error('No SMT solver available. Assertion checking will not be performed.');
  }

  var responses = {};
  for (var query in queries) {
    responses[query] = solve(queries[query]).contents;
  }

  // Note: all existing solved queries are replaced.
  // This assumes that all neccessary queries are quested above.
  inputJSON.auxiliaryInput = { smtlib2responses: responses };
  return inputJSON;
}

module.exports = {
  handleSMTQueries: handleSMTQueries,
  smtSolve: solve
};
