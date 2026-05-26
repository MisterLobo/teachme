package cmd

import "github.com/spf13/cobra"

var dbCmd = &cobra.Command{
	Use: "db",
	Run: func(cmd *cobra.Command, args []string) {

	},
}

func init() {
	dbCmd.AddCommand(migrateCmd)
}
