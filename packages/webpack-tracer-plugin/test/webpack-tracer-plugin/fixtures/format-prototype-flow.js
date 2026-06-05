function CBaseObject() {
  this.Id = null;
}
InitClass(CBaseObject, CBaseNoIdObject, 0);
CBaseObject.prototype.isGlobalSkipAddId = function() {
  return false;
};

function CT_Hyperlink() {
  CBaseNoIdObject.call(this);
}
CT_Hyperlink.prototype.Write_ToBinary = function() {
  return 1;
};
