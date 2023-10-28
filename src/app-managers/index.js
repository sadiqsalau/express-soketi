module.exports = {
  ...require("./app-manager"),
  ...require("./app-manager-interface"),
  ...require("./array-app-manager"),
  ...require("./base-app-manager"),
  ...require("./dynamodb-app-manager"),
  ...require("./mysql-app-manager"),
  ...require("./postgres-app-manager"),
  ...require("./sql-app-manager"),
};
