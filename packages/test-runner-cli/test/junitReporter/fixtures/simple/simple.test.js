describe('real numbers forming a monoid', function () {
  it('under addition', function () {
    chai.expect(1 + 1).to.equal(2);
  });
});

describe('off-by-one boolean logic errors', function () {
  it('null hypothesis', function () {
    chai.expect(true).to.be.true;
  });

  it('asserts error', function () {
    chai.expect(false).to.be.true;
  })

  it.skip('tbd: confirm true positive', function () {
    chai.expect(false).to.be.false;
  });
});