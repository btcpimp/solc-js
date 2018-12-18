contract C {
  // Leaving an empty line here intentionally


  function f() returns (bytes4) {
    return this.f.selector;
  }
}
